import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireSection } from "./permissions";
import { safeDbError } from "./safe-errors";

const inputSchema = z.object({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

type Counts = Record<string, number>;

function tally(rows: { symptom?: string | null }[]): Counts {
  const c: Counts = {};
  for (const r of rows) {
    if (!r.symptom) continue;
    c[r.symptom] = (c[r.symptom] ?? 0) + 1;
  }
  return c;
}

const RED_FLAG_RE = /\[red_flags:([^\]]+)\]/;

function bucketTimeOfDay(iso: string | null | undefined): "morning" | "afternoon" | "evening" | "night" | null {
  if (!iso) return null;
  const h = new Date(iso).getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 22) return "evening";
  return "night";
}

async function gatherStats(supabase: any, householdId: string, start: string, end: string) {
  // Symptoms from daily logs within the period
  const { data: logs } = await supabase
    .from("daily_logs")
    .select("id, log_date, sleep_hours, sleep_quality, caregiver_distress, quick_ok, log_symptoms(symptom, time_of_day, antecedent, outcome, intervention_tried, created_at)")
    .eq("household_id", householdId)
    .gte("log_date", start)
    .lte("log_date", end)
    .is("deleted_at", null);

  const allSymptoms: any[] = [];
  for (const l of logs ?? []) for (const s of l.log_symptoms ?? []) allSymptoms.push({ ...s, log_date: l.log_date });

  const symptomCounts = tally(allSymptoms);

  // Top antecedent -> symptom pairs (transparent counts)
  const pairCounts: Record<string, { antecedent: string; symptom: string; count: number; total: number; helped: number }> = {};
  for (const s of allSymptoms) {
    if (!s.antecedent) continue;
    const key = `${s.antecedent}::${s.symptom}`;
    if (!pairCounts[key]) pairCounts[key] = { antecedent: s.antecedent, symptom: s.symptom, count: 0, total: 0, helped: 0 };
    pairCounts[key].count++;
  }
  for (const s of allSymptoms) {
    for (const key of Object.keys(pairCounts)) {
      const [, sym] = key.split("::");
      if (sym === s.symptom) pairCounts[key].total++;
    }
    if (s.outcome === "helped") {
      for (const key of Object.keys(pairCounts)) {
        if (key.endsWith(`::${s.symptom}`)) pairCounts[key].helped++;
      }
    }
  }
  const topPatterns = Object.values(pairCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Prior period (same length) trend baseline
  const ms = Date.parse(end) - Date.parse(start);
  const prevEnd = new Date(Date.parse(start) - 86400000).toISOString().slice(0, 10);
  const prevStart = new Date(Date.parse(start) - 86400000 - ms).toISOString().slice(0, 10);
  const { data: prevLogs } = await supabase
    .from("daily_logs")
    .select("id, sleep_hours, caregiver_distress, log_symptoms(symptom, created_at)")
    .eq("household_id", householdId)
    .gte("log_date", prevStart)
    .lte("log_date", prevEnd)
    .is("deleted_at", null);
  const prevSymptoms: any[] = [];
  for (const l of prevLogs ?? []) for (const s of l.log_symptoms ?? []) prevSymptoms.push(s);
  const prevCounts = tally(prevSymptoms);

  // Cue adherence
  const { data: cueEvents } = await supabase
    .from("cue_events")
    .select("status, cues!inner(household_id)")
    .eq("cues.household_id", householdId)
    .gte("created_at", `${start}T00:00:00Z`)
    .lte("created_at", `${end}T23:59:59Z`);
  const total = cueEvents?.length ?? 0;
  const done = (cueEvents ?? []).filter((e: any) => e.status === "done").length;
  const adherence = total > 0 ? Math.round((done / total) * 100) : null;

  // Episodes in period (for red flags, distress, time-of-day, interventions)
  const { data: episodes } = await supabase
    .from("episodes")
    .select("id, symptom, antecedent, intervention_tried, outcome, time_of_day, occurred_at, caregiver_distress, description, severity")
    .eq("household_id", householdId)
    .gte("occurred_at", `${start}T00:00:00Z`)
    .lte("occurred_at", `${end}T23:59:59Z`)
    .is("deleted_at", null);

  // Red flags (parsed from episode description tag)
  const redFlagEvents: { occurred_at: string; flags: string[] }[] = [];
  for (const e of episodes ?? []) {
    const m = (e.description ?? "").match(RED_FLAG_RE);
    if (m) redFlagEvents.push({ occurred_at: e.occurred_at, flags: m[1].split(",").filter(Boolean) });
  }
  const nearCrises = (episodes ?? []).filter((e: any) => (e.severity ?? 0) >= 4).length;

  // Combined per-symptom occurrences (logs + episodes) for first-seen and time-of-day
  type Occ = { symptom: string; at: string; time_of_day: string | null };
  const occurrences: Occ[] = [];
  for (const s of allSymptoms) {
    occurrences.push({
      symptom: s.symptom,
      at: s.created_at ?? s.log_date,
      time_of_day: s.time_of_day ?? bucketTimeOfDay(s.created_at),
    });
  }
  for (const e of episodes ?? []) {
    if (!e.symptom) continue;
    occurrences.push({
      symptom: e.symptom,
      at: e.occurred_at,
      time_of_day: e.time_of_day ?? bucketTimeOfDay(e.occurred_at),
    });
  }

  // First-seen-this-period per symptom
  const firstSeen: Record<string, string> = {};
  for (const o of occurrences) {
    if (!firstSeen[o.symptom] || o.at < firstSeen[o.symptom]) firstSeen[o.symptom] = o.at;
  }

  // New symptoms = present this period AND zero in prior period
  const newSymptoms = Object.keys(symptomCounts)
    .filter((s) => !(prevCounts[s] > 0))
    .map((s) => ({ symptom: s, first_seen: firstSeen[s] ?? null, count: symptomCounts[s] }));

  // Escalations = count this period > prior (and prior > 0)
  const escalations = Object.keys(symptomCounts)
    .filter((s) => (prevCounts[s] ?? 0) > 0 && symptomCounts[s] > (prevCounts[s] ?? 0))
    .map((s) => ({ symptom: s, now: symptomCounts[s], before: prevCounts[s] ?? 0 }));

  // Time-of-day heatmap: { symptom: { morning, afternoon, evening, night } }
  const tod: Record<string, Record<string, number>> = {};
  for (const o of occurrences) {
    if (!o.time_of_day) continue;
    tod[o.symptom] = tod[o.symptom] ?? { morning: 0, afternoon: 0, evening: 0, night: 0 };
    tod[o.symptom][o.time_of_day] = (tod[o.symptom][o.time_of_day] ?? 0) + 1;
  }

  // Intervention effectiveness (interventions in logs + episodes)
  type IRow = { intervention: string; tried: number; helped: number };
  const interventions: Record<string, IRow> = {};
  const allActs = [
    ...allSymptoms.map((s) => ({ tried: s.intervention_tried, outcome: s.outcome })),
    ...(episodes ?? []).map((e: any) => ({ tried: e.intervention_tried, outcome: e.outcome })),
  ];
  for (const a of allActs) {
    const name = (a.tried ?? "").trim();
    if (!name) continue;
    interventions[name] = interventions[name] ?? { intervention: name, tried: 0, helped: 0 };
    interventions[name].tried++;
    if (a.outcome === "helped") interventions[name].helped++;
  }
  const interventionRanking = Object.values(interventions)
    .sort((a, b) => b.helped - a.helped || b.tried - a.tried)
    .slice(0, 6);

  // Sleep trend (current vs prior, average hours)
  const avg = (xs: (number | null | undefined)[]) => {
    const vals = xs.filter((v): v is number => typeof v === "number");
    return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
  };
  const sleep = {
    current_avg: avg((logs ?? []).map((l: any) => l.sleep_hours)),
    prior_avg: avg((prevLogs ?? []).map((l: any) => l.sleep_hours)),
    nights_under_6: (logs ?? []).filter((l: any) => typeof l.sleep_hours === "number" && l.sleep_hours < 6).length,
    total_nights: (logs ?? []).filter((l: any) => typeof l.sleep_hours === "number").length,
  };

  // Caregiver distress trend (from episodes + daily_logs)
  const distressSeries: { date: string; value: number }[] = [];
  for (const l of logs ?? []) {
    if (typeof l.caregiver_distress === "number") distressSeries.push({ date: l.log_date, value: l.caregiver_distress });
  }
  for (const e of episodes ?? []) {
    if (typeof e.caregiver_distress === "number")
      distressSeries.push({ date: (e.occurred_at as string).slice(0, 10), value: e.caregiver_distress });
  }
  distressSeries.sort((a, b) => a.date.localeCompare(b.date));
  const distressCurrent = avg(distressSeries.map((d) => d.value));
  const priorDistress = avg((prevLogs ?? []).map((l: any) => l.caregiver_distress));
  const distressRising =
    typeof distressCurrent === "number" && typeof priorDistress === "number" && distressCurrent - priorDistress >= 0.5;

  // Patient profile footer (medication names + active cues)
  const { data: profile } = await supabase
    .from("patient_profile")
    .select("medication_names, conditions, display_name")
    .eq("household_id", householdId)
    .maybeSingle();
  const { data: activeCues } = await supabase
    .from("cues")
    .select("id, label")
    .eq("household_id", householdId)
    .is("deleted_at", null)
    .eq("active", true);

  // Concerns flagged for this visit (unresolved)
  const { data: concerns } = await supabase
    .from("caregiver_concerns")
    .select("id, text, created_at")
    .eq("household_id", householdId)
    .is("deleted_at", null)
    .is("resolved_at", null)
    .order("created_at", { ascending: false });

  return {
    period_start: start,
    period_end: end,
    prior_period: { start: prevStart, end: prevEnd },
    log_count: (logs ?? []).length,
    episode_count: (episodes ?? []).length,
    symptom_counts: symptomCounts,
    prior_symptom_counts: prevCounts,
    new_symptoms: newSymptoms,
    escalations,
    red_flag_events: redFlagEvents,
    near_crises: nearCrises,
    time_of_day: tod,
    intervention_ranking: interventionRanking,
    sleep,
    distress: {
      series: distressSeries,
      current_avg: distressCurrent,
      prior_avg: priorDistress,
      rising: distressRising,
    },
    medications: profile?.medication_names ?? [],
    active_cues: (activeCues ?? []).map((c: any) => c.label),
    concerns: (concerns ?? []).map((c: any) => c.text),
    top_patterns: topPatterns,
    cue_adherence_pct: adherence,
    cue_events_total: total,
    cue_events_done: done,
    samples: allSymptoms.slice(0, 80).map((s) => ({
      symptom: s.symptom,
      time_of_day: s.time_of_day,
      antecedent: s.antecedent,
      outcome: s.outcome,
      intervention_tried: s.intervention_tried,
      log_date: s.log_date,
    })),
  };
}

async function narrate(stats: any): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return "AI narrative unavailable: missing GEMINI_API_KEY.";

  const system = `You write a plain-language clinician-friendly paragraph describing what the family logged.
STRICT RULES:
- Use ONLY the counts and dates supplied. Do not invent symptoms, dates, or interventions.
- Never diagnose, prognose, or recommend treatment.
- Never imply causation. Use phrases like "logged" or "noted", not "caused" or "due to".
- Keep it under 180 words, one paragraph, no lists.
- Round percentages and counts as given. If a count is 0, say so plainly.`;

  const user = `Stats (transparent counts only):\n${JSON.stringify(stats, null, 2)}`;

  const resp = await (await import("./gemini.server")).geminiChat({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
  if (resp.status === 429) return "AI narrative unavailable: rate limit. Charts above are accurate; please retry shortly.";
  if (resp.status === 402) return "AI narrative unavailable: workspace credits exhausted.";
  if (!resp.ok) return "AI narrative unavailable.";
  const j = await resp.json();
  return j?.choices?.[0]?.message?.content?.trim() ?? "AI narrative unavailable.";
}

export const generatePhysicianSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { householdId } = await requireSection(context.supabase, context.userId, "physician_summary", "write");
    const stats = await gatherStats(context.supabase, householdId, data.period_start, data.period_end);
    const narrative = await narrate(stats);
    void import("./backboard.server").then(({ remember }) => remember(householdId, `Physician summary for ${data.period_start} to ${data.period_end}: ${narrative}`));
    const { data: row, error } = await context.supabase
      .from("physician_summaries")
      .insert({
        household_id: householdId,
        summary: narrative,
        stats,
        period_start: data.period_start,
        period_end: data.period_end,
        generated_by: context.userId,
      })
      .select("id, summary, stats, period_start, period_end, created_at")
      .single();
    if (error) throw safeDbError(error);
    return row;
  });

export const listPhysicianSummaries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { householdId } = await requireSection(context.supabase, context.userId, "physician_summary", "read");
    const { data } = await context.supabase
      .from("physician_summaries")
      .select("id, summary, stats, period_start, period_end, created_at")
      .eq("household_id", householdId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20);
    return { summaries: data ?? [] };
  });