import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { safeDbError } from "./safe-errors";

const langSchema = z.enum(["en", "es"]);

const startSchema = z.object({
  householdName: z.string().trim().min(1).max(120),
  preferredLanguage: langSchema,
  pin: z.string().regex(/^\d{4}$/),
  patient: z.object({
    displayName: z.string().trim().min(1).max(120),
    preferredName: z.string().trim().max(120).optional().default(""),
    addressAs: z.string().trim().max(120).optional().default(""),
    languages: z.array(langSchema).max(2).optional().default([]),
  }),
});

const keyPerson = z.object({
  name: z.string().trim().min(1).max(120),
  relationship: z.string().trim().max(120).optional().default(""),
  contact_method: z.string().trim().max(40).optional().default(""),
  contact_value: z.string().trim().max(200).optional().default(""),
});

const patchSchema = z.object({
  preferred_name: z.string().trim().max(120).nullable().optional(),
  address_as: z.string().trim().max(120).nullable().optional(),
  languages: z.array(langSchema).max(2).optional(),
  display_name: z.string().trim().min(1).max(120).optional(),
  language: langSchema.optional(),
  biography: z.string().max(4000).nullable().optional(),
  daily_routines: z.string().max(4000).nullable().optional(),
  music_preferences: z.array(z.string().min(1).max(120)).max(100).optional(),
  known_triggers: z.array(z.string().min(1).max(120)).max(100).optional(),
  likes: z.array(z.string().min(1).max(120)).max(100).optional(),
  dislikes: z.array(z.string().min(1).max(120)).max(100).optional(),
  calming_strategies: z.array(z.string().min(1).max(200)).max(100).optional(),
  key_people: z.array(keyPerson).max(50).optional(),
  culture_faith: z.string().max(500).nullable().optional(),
  profession: z.string().max(200).nullable().optional(),
  hometown: z.string().max(200).nullable().optional(),
  life_events: z.array(z.string().min(1).max(300)).max(50).optional(),
  diagnosis_type: z.string().max(200).nullable().optional(),
  diagnosis_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  stage_self_select: z.enum(["good_days", "mixed", "mostly_hard"]).nullable().optional(),
  medication_names: z.array(z.string().min(1).max(80)).max(50).optional(),
  conditions: z.array(z.string().min(1).max(120)).max(50).optional(),
  zip_code: z.string().trim().max(20).nullable().optional(),
  referral_consent: z.boolean().optional(),
  greeting_audio_path: z.string().max(500).nullable().optional(),
});

const saveStepSchema = z.object({
  step: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  patch: patchSchema,
  markComplete: z.boolean().optional().default(false),
});

async function getMembership(supabase: any, userId: string) {
  const { data } = await supabase
    .from("memberships")
    .select("household_id, role")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  return data as { household_id: string; role: string } | null;
}

export const startIntake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => startSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashPin } = await import("./pin.server");

    const existing = await getMembership(supabaseAdmin, userId);
    if (existing) {
      return { ok: true as const, householdId: existing.household_id, alreadyExists: true };
    }

    const pinHash = await hashPin(data.pin);

    const { data: household, error: hErr } = await supabaseAdmin
      .from("households")
      .insert({
        name: data.householdName,
        preferred_language: data.preferredLanguage,
        pin_hash: pinHash,
        intake_progress: { step1: true, step2: false, step3: false },
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

    const languages =
      data.patient.languages.length > 0 ? data.patient.languages : [data.preferredLanguage];

    const { error: pErr } = await supabaseAdmin.from("patient_profile").insert({
      household_id: householdId,
      display_name: data.patient.displayName,
      preferred_name: data.patient.preferredName || null,
      address_as: data.patient.addressAs || null,
      language: data.preferredLanguage,
      languages,
    });
    if (pErr) throw new Error(pErr.message);

    await supabaseAdmin.from("audit_log").insert({
      household_id: householdId,
      actor_id: userId,
      action: "intake.step1.completed",
      payload: {},
    });

    return { ok: true as const, householdId, alreadyExists: false };
  });

export const saveIntakeStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveStepSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const m = await getMembership(supabase, userId);
    if (!m) throw new Error("No household for user");

    const patch = { ...data.patch };
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from("patient_profile")
        .update(patch)
        .eq("household_id", m.household_id);
      if (error) throw safeDbError(error);
    }

    if (data.markComplete) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: hh } = await supabaseAdmin
        .from("households")
        .select("intake_progress")
        .eq("id", m.household_id)
        .maybeSingle();
      const progress = ((hh?.intake_progress as any) ?? {}) as Record<string, boolean>;
      progress[`step${data.step}`] = true;
      await supabaseAdmin
        .from("households")
        .update({ intake_progress: progress })
        .eq("id", m.household_id);
    }

    return { ok: true as const };
  });

export const setCaptureMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ mode: z.enum(["guided", "form"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const m = await getMembership(context.supabase, context.userId);
    if (!m) throw new Error("No household for user");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("households")
      .update({ intake_capture_mode: data.mode })
      .eq("id", m.household_id);
    return { ok: true as const };
  });

export const getIntakeState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const m = await getMembership(supabase, userId);
    if (!m) {
      return {
        hasHousehold: false as const,
        progress: { step1: false, step2: false, step3: false },
        captureMode: "guided" as const,
      };
    }
    const [{ data: hh }, { data: pp }] = await Promise.all([
      supabase
        .from("households")
        .select("id, name, preferred_language, intake_progress, intake_capture_mode")
        .eq("id", m.household_id)
        .maybeSingle(),
      supabase
        .from("patient_profile")
        .select(
          "display_name, preferred_name, address_as, language, languages, biography, daily_routines, music_preferences, known_triggers, likes, dislikes, calming_strategies, key_people, culture_faith, profession, hometown, life_events, diagnosis_type, diagnosis_date, stage_self_select, medication_names, conditions, zip_code, referral_consent, greeting_audio_path",
        )
        .eq("household_id", m.household_id)
        .maybeSingle(),
    ]);
    const progress = (hh?.intake_progress as any) ?? { step1: false, step2: false, step3: false };
    return {
      hasHousehold: true as const,
      householdId: m.household_id,
      household: hh,
      patient: pp,
      progress,
      captureMode: (hh?.intake_capture_mode ?? "guided") as "guided" | "form",
    };
  });

export const attachPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        items: z
          .array(
            z.object({
              path: z.string().min(1).max(500),
              caption: z.string().max(300).optional().nullable(),
            }),
          )
          .min(1)
          .max(50),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const m = await getMembership(context.supabase, context.userId);
    if (!m) throw new Error("No household for user");
    const rows = data.items.map((i) => ({
      household_id: m.household_id,
      storage_path: i.path,
      kind: "photo" as const,
      caption: i.caption || null,
      created_by: context.userId,
    }));
    const { error } = await context.supabase.from("media").insert(rows);
    if (error) throw safeDbError(error);
    return { ok: true as const, count: rows.length };
  });
