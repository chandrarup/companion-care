import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { EMOTIONS } from "./voice-emotion";

// Voice cloning inside the PUBLIC demo. Safeguards: consent required, per-IP limits, small uploads, a hard cap on
// simultaneous temporary voices, and automatic deletion of voices older than 3 hours (ElevenLabs plans have limited
// voice slots). Visitors never see the voice id — only a signed 3h token.
const MAX_ACTIVE = 14;
const TTL_HOURS = 3;

const cloneSchema = z.object({
  name: z.string().trim().min(1).max(40),
  consent: z.literal(true),
  samples: z
    .array(z.object({ base64: z.string().max(8 * 1024 * 1024), contentType: z.string().max(100), filename: z.string().max(120) }))
    .min(1)
    .max(3),
});

async function cleanupExpired() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { deleteVoice } = await import("./elevenlabs.server");
  const cutoff = new Date(Date.now() - TTL_HOURS * 3600_000).toISOString();
  const { data } = await supabaseAdmin.from("demo_voices").select("id, voice_id").lt("created_at", cutoff);
  for (const row of data ?? []) {
    await deleteVoice(row.voice_id as string);
    await supabaseAdmin.from("demo_voices").delete().eq("id", row.id);
  }
}

export const cloneDemoVoice = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => cloneSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; token: string; name: string } | { ok: false; error: string }> => {
    const { allow } = await import("./rate-limit.server");
    const { cloneVoice, hasElevenLabsKey } = await import("./elevenlabs.server");
    if (!hasElevenLabsKey()) return { ok: false, error: "Voice cloning isn't available right now. The default demo voice is still active." };
    if (!allow("demo-clone", 4, 60 * 60_000)) return { ok: false, error: "You've cloned a few voices already. Please try again later — your current voice still works." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      await cleanupExpired();
      const { count } = await supabaseAdmin.from("demo_voices").select("id", { count: "exact", head: true });
      if ((count ?? 0) >= MAX_ACTIVE) return { ok: false, error: "Lots of people are cloning voices right now. The default demo voice is still active — try again in a few minutes." };

      const files = data.samples.map((s, i) => ({
        bytes: Buffer.from(s.base64, "base64"),
        type: s.contentType || "audio/webm",
        filename: s.filename || `sample-${i + 1}.webm`,
      }));
      const created = await cloneVoice(`demo-${crypto.randomUUID().slice(0, 8)}`, files);
      if (created.requires_verification) {
        const { deleteVoice } = await import("./elevenlabs.server");
        await deleteVoice(created.voice_id);
        return { ok: false, error: "That recording couldn't be verified as a live human voice. Please record yourself speaking (not AI-generated audio) — the default demo voice is still active." };
      }
      await supabaseAdmin.from("demo_voices").insert({ voice_id: created.voice_id });
      const { signDemoVoiceToken } = await import("@/integrations/db/auth.server");
      return { ok: true, token: await signDemoVoiceToken(created.voice_id), name: data.name };
    } catch (e) {
      console.error("[demo-voice] clone failed:", (e as Error).message);
      return { ok: false, error: "We couldn't create that voice. Try a longer, clearer recording (about 30–60 seconds) — the default demo voice still works." };
    }
  });

const speakSchema = z.object({ token: z.string().max(2000), text: z.string().trim().min(1).max(200), emotion: z.enum(EMOTIONS).optional() });

/** Speak a short line (preview / reminder) in a visitor's cloned voice. Requires a valid token. */
export const demoSpeak = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => speakSchema.parse(d))
  .handler(async ({ data }) => {
    const { allow } = await import("./rate-limit.server");
    const { verifyDemoVoiceToken } = await import("@/integrations/db/auth.server");
    const voiceId = await verifyDemoVoiceToken(data.token);
    if (!voiceId) { console.warn("[demo-voice] speak: invalid or expired token"); return { audio: null as string | null }; }
    if (!allow("demo-speak", 30, 10 * 60_000)) { console.warn("[demo-voice] speak: rate limited"); return { audio: null as string | null }; }
    try {
      const { synthesize } = await import("./elevenlabs.server");
      return { audio: await synthesize(voiceId, data.text, data.emotion) };
    } catch (e) {
      console.error("[demo-voice] speak failed:", (e as Error).message);
      return { audio: null as string | null };
    }
  });

export const removeDemoVoice = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().max(2000) }).parse(d))
  .handler(async ({ data }) => {
    const { verifyDemoVoiceToken } = await import("@/integrations/db/auth.server");
    const voiceId = await verifyDemoVoiceToken(data.token);
    if (!voiceId) return { ok: true as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { deleteVoice } = await import("./elevenlabs.server");
    await deleteVoice(voiceId);
    await supabaseAdmin.from("demo_voices").delete().eq("voice_id", voiceId);
    return { ok: true as const };
  });
