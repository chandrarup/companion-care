import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { safeDbError } from "./safe-errors";

const schema = z.object({
  displayName: z.string().min(1).max(120),
  language: z.enum(["en", "es"]),
});

/**
 * Creates a solo household for a patient who is signing up themselves.
 * No-op if the user already has a household membership.
 * PIN is randomized — the patient doesn't need it; a caregiver who later
 * joins can update it from settings.
 */
export const completePatientSelfOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashPin } = await import("./pin.server");

    const { data: existing } = await supabaseAdmin
      .from("memberships")
      .select("household_id")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (existing) return { ok: true, householdId: existing.household_id, alreadyExists: true };

    const randomPin = String(Math.floor(1000 + Math.random() * 9000));
    const pinHash = await hashPin(randomPin);

    const { data: household, error: hErr } = await supabaseAdmin
      .from("households")
      .insert({
        name: `${data.displayName}'s space`,
        preferred_language: data.language,
        pin_hash: pinHash,
      })
      .select("id")
      .single();
    if (hErr || !household) throw safeDbError(hErr, "Failed to create household");

    const { error: mErr } = await supabaseAdmin.from("memberships").insert({
      user_id: userId,
      household_id: household.id,
      role: "primary_caregiver",
      permissions: { all: true },
    });
    if (mErr) throw new Error(mErr.message);

    const { error: pErr } = await supabaseAdmin.from("patient_profile").insert({
      household_id: household.id,
      display_name: data.displayName,
      language: data.language,
    });
    if (pErr) throw new Error(pErr.message);

    return { ok: true, householdId: household.id as string, alreadyExists: false };
  });