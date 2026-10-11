import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getCallerMembership } from "./permissions";
import { safeDbError } from "./safe-errors";

const WEEK_MS = 7 * 24 * 3600 * 1000;
const THRESHOLD = 3;

async function getHouseholdAndLang(supabase: any, userId: string) {
  const { data: m } = await supabase
    .from("memberships")
    .select("household_id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (!m) return null;
  const householdId = m.household_id as string;
  const { data: p } = await supabase
    .from("patient_profile")
    .select("language")
    .eq("household_id", householdId)
    .maybeSingle();
  return { householdId, language: (p?.language as string | undefined) ?? "en" };
}

/**
 * Surface curated training content for symptoms the household has seen often
 * this week (>= THRESHOLD), or which the fingerprint has surfaced as a pattern.
 */
export const listSurfacedTraining = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const ctx = await getHouseholdAndLang(supabase, userId);
    if (!ctx) return { cards: [] };
    const { householdId, language } = ctx;
    const since = new Date(Date.now() - WEEK_MS).toISOString();

    const { data: logs } = await supabase
      .from("log_symptoms")
      .select("symptom, created_at, daily_logs!inner(household_id, deleted_at)")
      .eq("daily_logs.household_id", householdId)
      .is("daily_logs.deleted_at", null)
      .gte("created_at", since);

    const counts = new Map<string, number>();
    for (const r of logs ?? []) {
      const s = (r as any).symptom as string | null;
      if (!s) continue;
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }

    const { data: insights } = await supabase
      .from("fingerprint_insights")
      .select("insight")
      .eq("household_id", householdId)
      .is("deleted_at", null);
    for (const row of insights ?? []) {
      const s = (row as any).insight?.symptom as string | undefined;
      if (s) counts.set(s, Math.max(counts.get(s) ?? 0, THRESHOLD));
    }

    const tags = [...counts.entries()]
      .filter(([, c]) => c >= THRESHOLD)
      .map(([s]) => s);
    if (tags.length === 0) return { cards: [] };

    const { data: rows } = await supabase
      .from("training_content")
      .select("id, title, body, video_url, source_attribution, action_card_text, symptom_tag")
      .in("symptom_tag", tags)
      .eq("language", language as "en" | "es")
      .is("deleted_at", null);

    const cards = (rows ?? []).map((r: any) => ({
      ...r,
      observed_count: counts.get(r.symptom_tag) ?? 0,
    }));
    return { cards };
  });

export const listAllTraining = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("training_content")
      .select("id, title, body, video_url, source_attribution, action_card_text, symptom_tag, language")
      .is("deleted_at", null)
      .order("symptom_tag");
    return { items: data ?? [] };
  });

export const recordTrainingFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      training_id: z.string().uuid(),
      helped: z.enum(["helped", "no_change", "worse"]).optional().nullable(),
      action_saved: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const m = await getCallerMembership(context.supabase, context.userId);
    const { error } = await context.supabase.from("training_feedback").insert({
      household_id: m.household_id,
      training_id: data.training_id,
      user_id: context.userId,
      helped: data.helped ?? null,
      action_saved: data.action_saved ?? false,
    });
    if (error) throw safeDbError(error);
    return { ok: true };
  });

// re-export for convenience
export const _z = z;