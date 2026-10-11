const DEFAULT_WINDOW_DAYS = 90;

type Row = {
  symptom: string | null;
  antecedent: string | null;
  intervention_tried: string | null;
  outcome: string | null;
};

export async function recomputeFingerprintInline(supabase: any, userId: string) {
  const { data: m } = await supabase
    .from("memberships")
    .select("household_id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (!m) return { surfaced: 0 };
  const householdId = m.household_id as string;
  const { data: h } = await supabase
    .from("households")
    .select("min_evidence")
    .eq("id", householdId)
    .maybeSingle();
  const minEvidence = (h?.min_evidence as number | undefined) ?? 4;

  const since = new Date(Date.now() - DEFAULT_WINDOW_DAYS * 86400 * 1000).toISOString();

  const { data: logRows } = await supabase
    .from("log_symptoms")
    .select(
      "symptom, antecedent, intervention_tried, outcome, created_at, daily_logs!inner(household_id, deleted_at)",
    )
    .eq("daily_logs.household_id", householdId)
    .is("daily_logs.deleted_at", null)
    .gte("created_at", since);

  const { data: epRows } = await supabase
    .from("episodes")
    .select("symptom, antecedent, intervention_tried, outcome")
    .eq("household_id", householdId)
    .is("deleted_at", null)
    .gte("occurred_at", since);

  const rows: Row[] = [...((logRows ?? []) as Row[]), ...((epRows ?? []) as Row[])].filter(
    (r) => r.symptom,
  );

  const symptomTotals = new Map<string, number>();
  for (const r of rows) {
    if (!r.symptom) continue;
    symptomTotals.set(r.symptom, (symptomTotals.get(r.symptom) ?? 0) + 1);
  }

  const antSymCounts = new Map<string, number>();
  const interventionOutcome = new Map<string, Map<string, Map<string, number>>>();
  for (const r of rows) {
    if (!r.antecedent || !r.symptom) continue;
    const key = `${r.antecedent}|${r.symptom}`;
    antSymCounts.set(key, (antSymCounts.get(key) ?? 0) + 1);
    if (r.intervention_tried && r.outcome) {
      if (!interventionOutcome.has(key)) interventionOutcome.set(key, new Map());
      const iv = interventionOutcome.get(key)!;
      if (!iv.has(r.intervention_tried)) iv.set(r.intervention_tried, new Map());
      const ov = iv.get(r.intervention_tried)!;
      ov.set(r.outcome, (ov.get(r.outcome) ?? 0) + 1);
    }
  }

  const computedAt = new Date().toISOString();
  const surfaced: any[] = [];
  for (const [key, count] of antSymCounts.entries()) {
    if (count < minEvidence) continue;
    const [antecedent, symptom] = key.split("|");
    const total = symptomTotals.get(symptom) ?? count;
    const whatHelped: Array<{ intervention: string; outcome: string; count: number }> = [];
    const iv = interventionOutcome.get(key);
    if (iv) {
      for (const [intervention, outcomes] of iv.entries()) {
        for (const [outcome, c] of outcomes.entries()) {
          if (outcome === "helped") whatHelped.push({ intervention, outcome, count: c });
        }
      }
      whatHelped.sort((a, b) => b.count - a.count);
    }
    surfaced.push({
      kind: "antecedent_symptom",
      antecedent,
      symptom,
      count,
      total,
      what_helped: whatHelped.slice(0, 5),
      window_days: DEFAULT_WINDOW_DAYS,
      min_evidence: minEvidence,
      computed_at: computedAt,
    });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: dismissed } = await supabaseAdmin
    .from("fingerprint_insights")
    .select("insight")
    .eq("household_id", householdId)
    .not("deleted_at", "is", null);
  const dismissedKeys = new Set(
    (dismissed ?? []).map((r: any) => `${r.insight?.antecedent}|${r.insight?.symptom}`),
  );

  await supabaseAdmin
    .from("fingerprint_insights")
    .delete()
    .eq("household_id", householdId)
    .is("deleted_at", null);

  const toInsert = surfaced
    .filter((s) => !dismissedKeys.has(`${s.antecedent}|${s.symptom}`))
    .map((s) => ({ household_id: householdId, insight: s }));
  if (toInsert.length > 0) {
    await supabaseAdmin.from("fingerprint_insights").insert(toInsert);
  }

  return { surfaced: surfaced.length, minEvidence, windowDays: DEFAULT_WINDOW_DAYS };
}