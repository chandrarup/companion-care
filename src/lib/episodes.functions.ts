import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ANTECEDENT_OPTIONS, OUTCOME_OPTIONS, SYMPTOM_OPTIONS } from "./daily-log.functions";
import { requireSection, isLocked } from "./permissions";
import { safeDbError } from "./safe-errors";

/**
 * Red flag signals the app must surface verbatim. The app NEVER interprets
 * beyond this prompt — see RED_FLAG_PROMPT.
 */
export const RED_FLAGS = [
  { id: "prolonged_confusion", label: "Prolonged confusion throughout the day" },
  { id: "no_recognize_caregiver", label: "New difficulty recognizing the caregiver" },
  { id: "hygiene_decline", label: "Decline in hygiene or grooming" },
  { id: "unusual_hallucinations", label: "Out-of-the-ordinary hallucinations" },
] as const;

export const RED_FLAG_PROMPT =
  "These signs can be serious. Please contact your doctor.";

const RED_FLAG_IDS = RED_FLAGS.map((r) => r.id) as readonly string[];

const createSchema = z.object({
  description: z.string().min(1).max(2000),
  occurred_at: z.string().datetime().optional(),
  duration_minutes: z.number().int().min(0).max(60 * 24).nullable().optional(),
  symptom: z.enum(SYMPTOM_OPTIONS).nullable().optional(),
  antecedent: z.enum(ANTECEDENT_OPTIONS).nullable().optional(),
  intervention_tried: z.string().max(500).nullable().optional(),
  outcome: z.enum(OUTCOME_OPTIONS).nullable().optional(),
  time_of_day: z.enum(["morning", "afternoon", "evening", "night"]).nullable().optional(),
  caregiver_distress: z.number().int().min(0).max(4).nullable().optional(),
  red_flags: z.array(z.enum(RED_FLAG_IDS as [string, ...string[]])).default([]),
});


export const createEpisode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { householdId } = await requireSection(context.supabase, context.userId, "episodes", "write");
    const description = data.red_flags.length
      ? `${data.description}\n\n[red_flags:${data.red_flags.join(",")}]`
      : data.description;
    const { data: ep, error } = await context.supabase
      .from("episodes")
      .insert({
        household_id: householdId,
        created_by: context.userId,
        description,
        occurred_at: data.occurred_at ?? new Date().toISOString(),
        severity: data.red_flags.length > 0 ? 5 : null,
        symptom: data.symptom ?? null,
        antecedent: data.antecedent ?? null,
        intervention_tried: data.intervention_tried ?? null,
        outcome: data.outcome ?? null,
        time_of_day: data.time_of_day ?? null,
        caregiver_distress: data.caregiver_distress ?? null,
      })
      .select("id")
      .single();
    if (error || !ep) throw safeDbError(error, "Failed to save episode");

    // Feed the trigger fingerprint after every confirmed episode.
    try {
      const { recomputeFingerprintInline } = await import("./fingerprint.server");
      await recomputeFingerprintInline(context.supabase, context.userId);
    } catch (e) {
      console.error("fingerprint recompute (episode) failed:", e);
    }

    return {
      id: ep.id as string,
      red_flags: data.red_flags,
      red_flag_prompt: data.red_flags.length > 0 ? RED_FLAG_PROMPT : null,
    };
  });

export const listRecentEpisodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { householdId } = await requireSection(context.supabase, context.userId, "episodes", "read");
    const { data } = await context.supabase
      .from("episodes")
      .select("id, description, occurred_at, symptom, antecedent, intervention_tried, outcome, severity")
      .eq("household_id", householdId)
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false })
      .limit(10);
    const { data: hh } = await context.supabase
      .from("households")
      .select("edit_lock_days")
      .eq("id", householdId)
      .maybeSingle();
    return { episodes: data ?? [], editLockDays: hh?.edit_lock_days ?? 3 };
  });

const updateEpisodeSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1).max(2000),
  intervention_tried: z.string().max(500).nullable().optional(),
  outcome: z.enum(OUTCOME_OPTIONS).nullable().optional(),
});

export const updateEpisode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateEpisodeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { householdId } = await requireSection(context.supabase, context.userId, "episodes", "write");
    const { data: row } = await context.supabase
      .from("episodes")
      .select("id, household_id, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (!row || row.household_id !== householdId) throw new Error("Not found");
    if (await isLocked(context.supabase, householdId, row.created_at)) {
      const err: any = new Error("This episode is locked and can no longer be edited.");
      err.status = 423;
      throw err;
    }
    const { error } = await context.supabase
      .from("episodes")
      .update({
        description: data.description,
        intervention_tried: data.intervention_tried ?? null,
        outcome: data.outcome ?? null,
      })
      .eq("id", data.id);
    if (error) throw safeDbError(error);
    return { ok: true };
  });