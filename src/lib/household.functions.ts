import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireSection } from "./permissions";
import { safeDbError } from "./safe-errors";

const langSchema = z.enum(["en", "es"]);

const onboardingSchema = z.object({
  householdName: z.string().min(1).max(120),
  preferredLanguage: langSchema,
  pin: z.string().regex(/^\d{4}$/),
  patient: z.object({
    displayName: z.string().min(1).max(120),
    language: langSchema,
    biography: z.string().max(4000).optional().default(""),
    dailyRoutines: z.string().max(4000).optional().default(""),
    musicPreferences: z.array(z.string().min(1).max(120)).max(50).default([]),
    knownTriggers: z.array(z.string().min(1).max(120)).max(50).default([]),
  }),
  photoPaths: z.array(z.string().min(1).max(500)).max(20).default([]),
});

/** Creates household + primary_caregiver membership + patient_profile + media rows. */
export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => onboardingSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashPin } = await import("./pin.server");

    // Block if user already in a household
    const { data: existing } = await supabaseAdmin
      .from("memberships")
      .select("household_id")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (existing) {
      return { ok: true, householdId: existing.household_id, alreadyExists: true };
    }

    const pinHash = await hashPin(data.pin);

    const { data: household, error: hErr } = await supabaseAdmin
      .from("households")
      .insert({
        name: data.householdName,
        preferred_language: data.preferredLanguage,
        pin_hash: pinHash,
      })
      .select("id")
      .single();
    if (hErr || !household) throw safeDbError(hErr, "Failed to create household");

    const householdId = household.id as string;

    const { error: mErr } = await supabaseAdmin.from("memberships").insert({
      user_id: userId,
      household_id: householdId,
      role: "primary_caregiver",
      permissions: { all: true },
    });
    if (mErr) throw new Error(mErr.message);

    const { error: pErr } = await supabaseAdmin.from("patient_profile").insert({
      household_id: householdId,
      display_name: data.patient.displayName,
      language: data.patient.language,
      biography: data.patient.biography ?? null,
      daily_routines: data.patient.dailyRoutines ?? null,
      music_preferences: data.patient.musicPreferences,
      known_triggers: data.patient.knownTriggers,
    });
    if (pErr) throw new Error(pErr.message);

    if (data.photoPaths.length > 0) {
      const rows = data.photoPaths.map((p) => ({
        household_id: householdId,
        storage_path: p,
        kind: "photo",
        created_by: userId,
      }));
      const { error: medErr } = await supabaseAdmin.from("media").insert(rows);
      if (medErr) throw new Error(medErr.message);
    }

    await supabaseAdmin.from("audit_log").insert({
      household_id: householdId,
      actor_id: userId,
      action: "household.created",
      payload: { photos: data.photoPaths.length },
    });

    return { ok: true, householdId, alreadyExists: false };
  });

/** Returns the caller's primary household (id, name, language, patient name) or null. */
export const getMyHousehold = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: membership } = await supabase
      .from("memberships")
      .select("household_id, role")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (!membership) return { household: null as any };

    const { data: household } = await supabase
      .from("households")
      .select("id, name, preferred_language, notify_window_start, notify_window_end, reminder_time, reminder_enabled, edit_lock_days")
      .eq("id", membership.household_id)
      .maybeSingle();
    const { data: patient } = await supabase
      .from("patient_profile")
      .select("display_name, language, biography, daily_routines, music_preferences, known_triggers, calming_strategies")
      .eq("household_id", membership.household_id)
      .maybeSingle();
    return { household, patient, role: membership.role };
  });

/** Verify caregiver PIN to unlock Caregiver mode. */
export const verifyHouseholdPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ pin: z.string().regex(/^\d{4}$/) }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyPin } = await import("./pin.server");

    const { data: membership } = await supabaseAdmin
      .from("memberships")
      .select("household_id")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (!membership) return { ok: false as const };

    const { data: household } = await supabaseAdmin
      .from("households")
      .select("pin_hash")
      .eq("id", membership.household_id)
      .maybeSingle();

    const ok = await verifyPin(data.pin, household?.pin_hash ?? null);
    return { ok };
  });

const settingsSchema = z.object({
  reminder_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  reminder_enabled: z.boolean().optional(),
  edit_lock_days: z.number().int().min(0).max(30).optional(),
  notify_window_start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  notify_window_end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export const updateHouseholdSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => settingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { householdId } = await requireSection(context.supabase, context.userId, "symptom_logs", "write");
    const patch: Record<string, any> = {};
    if (data.reminder_time !== undefined) patch.reminder_time = data.reminder_time;
    if (data.reminder_enabled !== undefined) patch.reminder_enabled = data.reminder_enabled;
    if (data.edit_lock_days !== undefined) patch.edit_lock_days = data.edit_lock_days;
    if (data.notify_window_start !== undefined) patch.notify_window_start = data.notify_window_start;
    if (data.notify_window_end !== undefined) patch.notify_window_end = data.notify_window_end;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase.from("households").update(patch as any).eq("id", householdId);
    if (error) throw safeDbError(error);
    return { ok: true };
  });