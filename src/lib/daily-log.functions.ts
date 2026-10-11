import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireSection, isLocked } from "./permissions";
import { safeDbError } from "./safe-errors";

const SYMPTOMS = [
  "forgetfulness",
  "confusion",
  "agitation",
  "constipation",
  "overstimulation",
  "understimulation",
  "poor_sleep",
  "appetite_change",
  "wandering",
  "other",
] as const;

const ANTECEDENTS = [
  "hunger",
  "thirst",
  "pain",
  "fatigue",
  "overstimulation",
  "understimulation",
  "missed_cue",
  "environment_change",
  "visitor_change",
  "unknown",
] as const;

const OUTCOMES = ["helped", "no_change", "worse", "unknown"] as const;

export const SYMPTOM_OPTIONS = SYMPTOMS;
export const ANTECEDENT_OPTIONS = ANTECEDENTS;
export const OUTCOME_OPTIONS = OUTCOMES;

const symptomEntry = z.object({
  symptom: z.enum(SYMPTOMS),
  time_of_day: z.string().max(40).optional().nullable(),
  antecedent: z.enum(ANTECEDENTS).optional().nullable(),
  intervention_tried: z.string().max(500).optional().nullable(),
  outcome: z.enum(OUTCOMES).optional().nullable(),
});

const createLogSchema = z.object({
  mood: z.number().int().min(1).max(5).optional().nullable(),
  sleep_quality: z.number().int().min(1).max(5).optional().nullable(),
  sleep_hours: z.number().min(0).max(24).optional().nullable(),
  caregiver_distress: z.number().int().min(0).max(4).optional().nullable(),
  quick_ok: z.boolean().optional().default(false),
  notes: z.string().max(4000).optional().nullable(),
  symptoms: z.array(symptomEntry).max(20).default([]),
});

async function getHouseholdId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("memberships")
    .select("household_id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (error) throw safeDbError(error);
  if (!data) throw new Error("No household for user");
  return data.household_id as string;
}

export const createDailyLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createLogSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { householdId } = await requireSection(supabase, userId, "symptom_logs", "write");

    const { data: log, error: lErr } = await supabase
      .from("daily_logs")
      .insert({
        household_id: householdId,
        created_by: userId,
        mood: data.mood != null ? String(data.mood) : null,
        sleep_quality: data.sleep_quality ?? null,
        sleep_hours: data.sleep_hours ?? null,
        caregiver_distress: data.caregiver_distress ?? null,
        quick_ok: data.quick_ok ?? false,
        notes: data.notes ?? null,
      })
      .select("id")
      .single();
    if (lErr || !log) throw safeDbError(lErr, "Failed to insert log");

    if (data.symptoms.length > 0) {
      const rows = data.symptoms.map((s) => ({
        daily_log_id: log.id,
        symptom: s.symptom,
        time_of_day: s.time_of_day ?? null,
        antecedent: s.antecedent ?? null,
        intervention_tried: s.intervention_tried ?? null,
        outcome: s.outcome ?? null,
      }));
      const { error: sErr } = await supabase.from("log_symptoms").insert(rows);
      if (sErr) throw new Error(sErr.message);
    }

    // Recompute the trigger fingerprint after a confirmed log.
    // Best-effort: do not fail the save if recompute throws.
    try {
      const { recomputeFingerprintInline } = await import("./fingerprint.server");
      await recomputeFingerprintInline(supabase, userId);
    } catch (e) {
      console.error("fingerprint recompute failed:", e);
    }

    // Long-term memory (Backboard): fire-and-forget; never blocks or fails the save.
    void import("./backboard.server").then(({ remember }) =>
      remember(
        householdId,
        `Caregiver log on ${new Date().toISOString().slice(0, 10)}: ` +
          [
            data.mood != null ? `mood ${data.mood}/5` : null,
            data.notes ? `notes: ${data.notes}` : null,
            ...data.symptoms.map((s) => `${s.symptom}${s.time_of_day ? ` (${s.time_of_day})` : ""}${s.antecedent ? ` after ${s.antecedent}` : ""}${s.intervention_tried ? `; tried ${s.intervention_tried}` : ""}${s.outcome ? ` -> ${s.outcome}` : ""}`),
          ].filter(Boolean).join("; "),
      ),
    );

    return { id: log.id as string };
  });

export const listRecentLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { householdId } = await requireSection(supabase, userId, "symptom_logs", "read");
    const { data, error } = await supabase
      .from("daily_logs")
      .select("id, log_date, mood, sleep_quality, notes, created_at, log_symptoms(symptom, time_of_day, antecedent, outcome)")
      .eq("household_id", householdId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw safeDbError(error);
    const { data: hh } = await supabase
      .from("households")
      .select("edit_lock_days")
      .eq("id", householdId)
      .maybeSingle();
    return { logs: data ?? [], editLockDays: hh?.edit_lock_days ?? 3 };
  });

export const hasLoggedToday = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { householdId } = await requireSection(supabase, userId, "symptom_logs", "read");
    const today = new Date().toISOString().slice(0, 10);
    const { count } = await supabase
      .from("daily_logs")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdId)
      .eq("log_date", today)
      .is("deleted_at", null);
    return { logged: (count ?? 0) > 0 };
  });

const updateLogSchema = z.object({
  id: z.string().uuid(),
  mood: z.number().int().min(1).max(5).nullable().optional(),
  sleep_quality: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
});

export const updateDailyLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateLogSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { householdId } = await requireSection(supabase, userId, "symptom_logs", "write");
    const { data: row } = await supabase
      .from("daily_logs")
      .select("id, household_id, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (!row || row.household_id !== householdId) throw new Error("Not found");
    if (await isLocked(supabase, householdId, row.created_at)) {
      const err: any = new Error("This log is locked and can no longer be edited.");
      err.status = 423;
      throw err;
    }
    const { error } = await supabase
      .from("daily_logs")
      .update({
        mood: data.mood != null ? String(data.mood) : null,
        sleep_quality: data.sleep_quality ?? null,
        notes: data.notes ?? null,
      })
      .eq("id", data.id);
    if (error) throw safeDbError(error);
    return { ok: true };
  });

const extractInput = z.object({ transcript: z.string().min(1).max(4000) });

export const extractLogFromTranscript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => extractInput.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("Missing GEMINI_API_KEY");

    const systemPrompt = `You extract caregiver observations about a person with dementia into structured JSON.
Return ONLY valid JSON matching this shape:
{
  "mood": <integer 1-5 or null>,
  "summary": <short string or null>,
  "symptoms": [
    {
      "symptom": one of ${SYMPTOMS.join(", ")},
      "time_of_day": <free text like "morning", "6pm", or null>,
      "antecedent": one of ${ANTECEDENTS.join(", ")} or null,
      "intervention_tried": <free text or null>,
      "outcome": one of ${OUTCOMES.join(", ")} or null
    }
  ]
}
Mood scale: 1=very distressed, 3=neutral, 5=very content. Use null when not stated.`;

    const resp = await (await import("./gemini.server")).geminiChat({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: data.transcript },
        ],
        response_format: { type: "json_object" },
      });

    if (resp.status === 429) throw new Error("AI rate limit exceeded. Please try again shortly.");
    if (resp.status === 402) throw new Error("AI credits exhausted. Please add credits in workspace settings.");
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`AI gateway error ${resp.status}: ${txt}`);
    }

    const json = await resp.json();
    const content = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("AI returned non-JSON output");
    }

    // Best-effort normalization
    const safeSymptoms = Array.isArray(parsed?.symptoms) ? parsed.symptoms : [];
    const cleaned = safeSymptoms
      .map((s: any) => ({
        symptom: SYMPTOMS.includes(s?.symptom) ? s.symptom : "other",
        time_of_day: typeof s?.time_of_day === "string" ? s.time_of_day : null,
        antecedent: ANTECEDENTS.includes(s?.antecedent) ? s.antecedent : null,
        intervention_tried: typeof s?.intervention_tried === "string" ? s.intervention_tried : null,
        outcome: OUTCOMES.includes(s?.outcome) ? s.outcome : null,
      }))
      .slice(0, 20);

    const mood = Number.isInteger(parsed?.mood) && parsed.mood >= 1 && parsed.mood <= 5 ? parsed.mood : null;
    const summary = typeof parsed?.summary === "string" ? parsed.summary : null;

    return { mood, summary, symptoms: cleaned };
  });