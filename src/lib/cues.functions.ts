import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { safeDbError } from "./safe-errors";

export const CUE_TYPES = ["hydration", "medication", "appointment", "custom"] as const;

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  cue_type: z.enum(CUE_TYPES),
  label: z.string().min(1).max(120),
  schedule_times: z.array(z.string().regex(timeRe)).min(1).max(12),
  days_of_week: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  active: z.boolean().default(true),
});

async function getHouseholdId(supabase: any, userId: string) {
  const { data } = await supabase
    .from("memberships")
    .select("household_id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  return (data?.household_id as string | undefined) ?? null;
}

export const listCues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const householdId = await getHouseholdId(context.supabase, context.userId);
    if (!householdId) return { cues: [] };
    const { data, error } = await context.supabase
      .from("cues")
      .select("id, cue_type, label, schedule_times, days_of_week, active, created_at")
      .eq("household_id", householdId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw safeDbError(error);
    return { cues: data ?? [] };
  });

export const upsertCue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const householdId = await getHouseholdId(context.supabase, context.userId);
    if (!householdId) throw new Error("No household for user");
    const row = {
      household_id: householdId,
      cue_type: data.cue_type,
      label: data.label,
      schedule_times: data.schedule_times,
      days_of_week: data.days_of_week,
      active: data.active,
    };
    if (data.id) {
      const { error } = await context.supabase.from("cues").update(row).eq("id", data.id);
      if (error) throw safeDbError(error);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase
      .from("cues")
      .insert(row)
      .select("id")
      .single();
    if (error || !ins) throw safeDbError(error, "Failed to create cue");
    return { id: ins.id as string };
  });

export const deleteCue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("cues")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw safeDbError(error);
    return { ok: true };
  });

export const logCueEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cue_id: z.string().uuid(),
        outcome: z.enum(["done", "missed", "snoozed"]),
        scheduled_for: z.string().datetime().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("cue_events").insert({
      cue_id: data.cue_id,
      outcome: data.outcome,
      scheduled_for: data.scheduled_for ?? null,
    });
    if (error) throw safeDbError(error);
    return { ok: true };
  });

/**
 * Returns today's pending cue firings for the household — cues scheduled for
 * today's weekday whose time has passed and that have no event in the last
 * 12 hours.
 */
export const todaysPendingCues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const householdId = await getHouseholdId(context.supabase, context.userId);
    if (!householdId) return { pending: [] };
    const { data: cues } = await context.supabase
      .from("cues")
      .select("id, cue_type, label, schedule_times, days_of_week, active")
      .eq("household_id", householdId)
      .eq("active", true)
      .is("deleted_at", null);

    const now = new Date();
    const day = now.getDay();
    const hhmmNow = now.toTimeString().slice(0, 5);
    const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    const ids = (cues ?? []).map((c: any) => c.id);
    const { data: recent } = ids.length
      ? await context.supabase
          .from("cue_events")
          .select("cue_id, scheduled_for, occurred_at")
          .in("cue_id", ids)
          .gte("occurred_at", since)
      : { data: [] };
    const ackedKey = new Set<string>(
      (recent ?? []).map((e: any) => `${e.cue_id}|${(e.scheduled_for ?? "").slice(11, 16)}`),
    );

    const pending: Array<{ cue_id: string; label: string; cue_type: string; time: string }> = [];
    for (const c of cues ?? []) {
      if (!c.days_of_week?.includes(day)) continue;
      for (const t of c.schedule_times ?? []) {
        if (t > hhmmNow) continue;
        if (ackedKey.has(`${c.id}|${t}`)) continue;
        pending.push({ cue_id: c.id, label: c.label, cue_type: c.cue_type, time: t });
      }
    }
    pending.sort((a, b) => a.time.localeCompare(b.time));
    return { pending };
  });