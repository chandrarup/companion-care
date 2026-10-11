import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isVoiceMood, resolveMood } from "./voice-emotion";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getCallerMembership } from "./permissions";

const turn = z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(1000) });
const input = z.object({
  history: z.array(turn).max(40).default([]),
  userText: z.string().min(1).max(400),
  lang: z.enum(["en", "es"]).default("en"),
});

/**
 * Live companion conversation for the patient. Gemini replies under the guardrails, grounded ONLY in the
 * patient-safe life-story memory (Backboard "life" assistant + profile). Care-log memory is never used here.
 * Returns the reply plus audio in the caregiver's cloned voice when one is set up.
 */
export const companionReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { generateCompanionReply } = await import("./companion-core.server");
    const { recall, remember, profileFacts } = await import("./backboard.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fallbackReply } = await import("./guardrails");

    const m = await getCallerMembership(context.supabase, context.userId);
    const { data: profile } = await context.supabase.from("patient_profile").select("*").eq("household_id", m.household_id).maybeSingle();
    const name = ((profile?.preferred_name || profile?.display_name || "").toString().trim().split(/\s+/)[0]) || (data.lang === "es" ? "amiga" : "friend");

    const { data: carers } = await supabaseAdmin
      .from("memberships")
      .select("role, users:user_id(display_name)")
      .eq("household_id", m.household_id)
      .eq("role", "primary_caregiver")
      .is("deleted_at", null)
      .limit(1);
    const caregiver = ((carers?.[0]?.users?.display_name as string | undefined) ?? "").trim().split(/\s+/)[0] || (data.lang === "es" ? "tu cuidador" : "your caregiver");

    const memories = await recall(m.household_id, data.userText, "life");
    const facts = [...new Set([...memories, ...profileFacts(profile).slice(0, 8)])].slice(0, 12);

    let r;
    try {
      r = await generateCompanionReply({ lang: data.lang, name, caregiver, facts, history: data.history, userText: data.userText });
    } catch (e) {
      console.error(e);
      r = { reply: fallbackReply(data.lang), source: "fallback" as const, flag: undefined };
    }

    // What was said goes to the CARE memory (caregiver-only), never back into the patient's life story.
    void remember(
      m.household_id,
      `${name} said: "${data.userText}"${r.flag ? " (seemed distressed or hurt — caregiver should check in)" : ""}. Companion replied: "${r.reply}"`,
    );

    let audio: string | null = null;
    try {
      const { synthesize, hasElevenLabsKey } = await import("./elevenlabs.server");
      if (hasElevenLabsKey() && profile?.caregiver_voice_id) {
        const emotion = resolveMood(isVoiceMood(profile.caregiver_voice_emotion) ? profile.caregiver_voice_emotion : "auto", data.userText, r.flag);
        audio = await synthesize(profile.caregiver_voice_id as string, r.reply, emotion);
        console.info(`[companion] emotion ${emotion} (picked: ${profile.caregiver_voice_emotion})`);
        console.info(`[companion] spoke in household caregiver voice …${String(profile.caregiver_voice_id).slice(-4)}`);
      } else {
        console.info(`[companion] no caregiver voice set for this household (key=${hasElevenLabsKey()}, voice=${!!profile?.caregiver_voice_id})`);
      }
    } catch (e) {
      console.error("[companion] tts failed:", (e as Error).message);
    }
    return { reply: r.reply, audio, flag: r.flag };
  });
