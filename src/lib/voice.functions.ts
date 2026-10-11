import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getCallerMembership, requireSection } from "./permissions";
import { VOICE_MOODS, isVoiceMood, resolveMood } from "./voice-emotion";

/** Which voice (if any) is set up for the caller's household. */
export const getVoiceStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { hasElevenLabsKey } = await import("./elevenlabs.server");
    const m = await getCallerMembership(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("patient_profile")
      .select("caregiver_voice_id, caregiver_voice_name, voice_consent_at, caregiver_voice_emotion")
      .eq("household_id", m.household_id)
      .maybeSingle();
    return {
      available: hasElevenLabsKey(),
      hasVoice: !!data?.caregiver_voice_id,
      name: (data?.caregiver_voice_name as string | null) ?? null,
      consentAt: (data?.voice_consent_at as string | null) ?? null,
      emotion: isVoiceMood(data?.caregiver_voice_emotion) ? data.caregiver_voice_emotion : ("auto" as const),
    };
  });

const MAX_FILE_B64 = 12 * 1024 * 1024;
const cloneSchema = z.object({
  name: z.string().trim().min(1).max(60),
  consent: z.literal(true),
  samples: z
    .array(z.object({ base64: z.string().max(MAX_FILE_B64), contentType: z.string().max(100), filename: z.string().max(120) }))
    .min(1)
    .max(5),
});

/** Create an ElevenLabs Instant Voice Clone from recordings and attach it to the household. */
export const cloneCaregiverVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => cloneSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { cloneVoice, deleteVoice, hasElevenLabsKey } = await import("./elevenlabs.server");
    if (!hasElevenLabsKey()) throw new Error("Voice cloning is not configured (missing ELEVENLABS_API_KEY).");
    const { householdId } = await requireSection(context.supabase, context.userId, "photos", "write");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const files = data.samples.map((s, i) => ({
      bytes: Buffer.from(s.base64, "base64"),
      type: s.contentType || "audio/webm",
      filename: s.filename || `sample-${i + 1}.webm`,
    }));
    const { data: prev } = await supabaseAdmin.from("patient_profile").select("caregiver_voice_id").eq("household_id", householdId).maybeSingle();

    const created = await cloneVoice(data.name, files);
    if (created.requires_verification) {
      await deleteVoice(created.voice_id);
      throw new Error("That recording couldn't be verified as a live human voice. Please record yourself speaking (not AI-generated audio).");
    }
    const { error } = await supabaseAdmin
      .from("patient_profile")
      .update({
        caregiver_voice_id: created.voice_id,
        caregiver_voice_name: data.name,
        voice_consent_at: new Date().toISOString(),
        voice_consent_by: context.userId,
      })
      .eq("household_id", householdId);
    if (error) {
      await deleteVoice(created.voice_id);
      throw new Error("Could not save the voice. Please try again.");
    }
    if (prev?.caregiver_voice_id) await deleteVoice(prev.caregiver_voice_id as string);
    return { ok: true as const, name: data.name };
  });

export const removeCaregiverVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { deleteVoice, hasElevenLabsKey } = await import("./elevenlabs.server");
    const { householdId } = await requireSection(context.supabase, context.userId, "photos", "write");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prev } = await supabaseAdmin.from("patient_profile").select("caregiver_voice_id").eq("household_id", householdId).maybeSingle();
    if (prev?.caregiver_voice_id && hasElevenLabsKey()) await deleteVoice(prev.caregiver_voice_id as string);
    await supabaseAdmin
      .from("patient_profile")
      .update({ caregiver_voice_id: null, caregiver_voice_name: null, voice_consent_at: null, voice_consent_by: null })
      .eq("household_id", householdId);
    return { ok: true as const };
  });

const speakSchema = z.object({ text: z.string().trim().min(1).max(600) });

/** Speak text in the household's cloned caregiver voice. Returns null if none is set up. */
export const speakCaregiver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => speakSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { synthesize, hasElevenLabsKey } = await import("./elevenlabs.server");
    if (!hasElevenLabsKey()) return { audio: null as string | null };
    const m = await getCallerMembership(context.supabase, context.userId);
    const { data: p } = await context.supabase
      .from("patient_profile")
      .select("caregiver_voice_id, caregiver_voice_emotion")
      .eq("household_id", m.household_id)
      .maybeSingle();
    if (!p?.caregiver_voice_id) return { audio: null as string | null };
    try {
      return { audio: await synthesize(p.caregiver_voice_id as string, data.text, resolveMood(isVoiceMood(p.caregiver_voice_emotion) ? p.caregiver_voice_emotion : "auto")) };
    } catch (e) {
      console.error(e);
      return { audio: null as string | null };
    }
  });

/** Choose how the household's caregiver voice speaks (warm, calm, cheerful, gentle). */
export const setVoiceEmotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ emotion: z.enum(VOICE_MOODS) }).parse(d))
  .handler(async ({ data, context }) => {
    const { householdId } = await requireSection(context.supabase, context.userId, "photos", "write");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("patient_profile").update({ caregiver_voice_emotion: data.emotion }).eq("household_id", householdId);
    if (error) throw new Error("Could not save that setting. Please try again.");
    return { ok: true as const };
  });
