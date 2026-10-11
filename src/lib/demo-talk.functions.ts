import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { VOICE_MOODS, resolveMood, type Emotion } from "./voice-emotion";

const messageSchema = z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(1000) });
const input = z.object({
  lang: z.enum(["en", "es"]),
  history: z.array(messageSchema).max(40).default([]),
  userText: z.string().min(1).max(400),
  voiceToken: z.string().max(2000).optional(),
  emotion: z.enum(VOICE_MOODS).optional(),
});

export type DemoReply = {
  reply: string;
  audio: string | null; // base64 mp3 in the active voice, when available
  emotion?: Emotion; // the feeling the reply was spoken with
  cannedId?: string; // set when the reply is a pre-written one (a pre-generated audio file exists for it)
  flag?: "distress";
};

const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);

async function voiceFor(token?: string): Promise<string | null> {
  if (token) {
    const { verifyDemoVoiceToken } = await import("@/integrations/db/auth.server");
    const v = await verifyDemoVoiceToken(token);
    if (v) return v;
  }
  return process.env.ELEVENLABS_VOICE_ID || null;
}

async function tts(voiceId: string, text: string, ms: number, emotion?: Emotion): Promise<string | null> {
  const { synthesize } = await import("./elevenlabs.server");
  return withTimeout(
    synthesize(voiceId, text, emotion).catch((e) => {
      console.error("[demo-talk] synthesize failed:", (e as Error).message);
      return null;
    }),
    ms,
    null,
  );
}

/** Speak in the visitor's cloned voice if they made one; if that voice is refused or slow, use the default demo voice. */
async function speak(text: string, token: string | undefined, ms = 8000, emotion?: Emotion): Promise<string | null> {
  try {
    const { hasElevenLabsKey } = await import("./elevenlabs.server");
    if (!hasElevenLabsKey()) return null;
    const own = token ? await voiceFor(token) : null;
    const fallbackVoice = process.env.ELEVENLABS_VOICE_ID || null;
    if (token) console.info(`[demo-talk] visitor token ${own ? "valid" : "INVALID/expired"}; own voice …${own?.slice(-4) ?? "-"}`);
    if (own && own !== fallbackVoice) {
      const a = await tts(own, text, ms, emotion);
      if (a) { console.info(`[demo-talk] spoke in VISITOR voice …${own.slice(-4)} emotion=${emotion ?? "warm"}`); return a; }
      console.warn(`[demo-talk] visitor voice …${own.slice(-4)} failed; falling back to default`);
    }
    console.info(`[demo-talk] emotion=${emotion ?? "warm"}`);
    console.info(`[demo-talk] spoke in DEFAULT voice …${fallbackVoice?.slice(-4)}`);
    return fallbackVoice ? await tts(fallbackVoice, text, ms, emotion) : null;
  } catch (e) {
    console.error("[demo-talk] speak failed:", (e as Error).message);
    return null;
  }
}

/**
 * Public demo chat (no sign-in) with synthetic Rosa. NOTHING here may fail the demo:
 *  - every external call (Backboard, Gemini, ElevenLabs) has a time budget,
 *  - any failure falls back to a pre-written, on-topic reminiscence reply (with pre-generated audio),
 *  - memory is read-only, so visitors can't pollute it; rate limits protect quota but degrade gracefully.
 */
export const demoTalkReply = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data }): Promise<DemoReply> => {
    const { pickCanned } = await import("./demo/rosa-canned");
    const canned = async (): Promise<DemoReply> => {
      const c = pickCanned(data.lang, data.userText);
      return { reply: c.text, audio: await speak(c.text, data.voiceToken, 5000, resolveMood(data.emotion, data.userText)), emotion: resolveMood(data.emotion, data.userText), cannedId: c.id };
    };
    try {
      const { allow } = await import("./rate-limit.server");
      if (!allow("demo-talk", 90, 10 * 60_000) || !allow("demo-talk-day", 1500, 24 * 60 * 60_000)) return await canned();

      const work = async (): Promise<DemoReply | null> => {
        const { generateCompanionReply } = await import("./companion-core.server");
        const { recallDemo } = await import("./backboard.server");
        const { ROSA_LIFE_FACTS, DEMO_PATIENT_NAME, DEMO_CAREGIVER_NAME } = await import("./demo/rosa-facts");
        const memories = await withTimeout(recallDemo(data.userText), 3500, [] as string[]);
        const facts = [...new Set([...memories, ...ROSA_LIFE_FACTS])].slice(0, 12);
        const r = await generateCompanionReply({
          lang: data.lang, name: DEMO_PATIENT_NAME, caregiver: DEMO_CAREGIVER_NAME, facts, history: data.history, userText: data.userText,
        });
        if (r.source === "fallback") return null; // use the on-topic canned bank instead of a generic line
        return { reply: r.reply, audio: await speak(r.reply, data.voiceToken, 8000, resolveMood(data.emotion, data.userText, r.flag)), emotion: resolveMood(data.emotion, data.userText, r.flag), flag: r.flag };
      };
      const out = await withTimeout(work().catch(() => null), 9_000, null);
      return out ?? (await canned());
    } catch (e) {
      console.error("[demo-talk] failed, using canned:", (e as Error).message);
      return await canned();
    }
  });

/** Fixed demo greeting in the active demo voice. Accepts no free text. */
export const demoGreetingAudio = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ lang: z.enum(["en", "es"]), voiceToken: z.string().max(2000).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { allow } = await import("./rate-limit.server");
    if (!allow("demo-greet", 40, 10 * 60_000)) return { audio: null as string | null };
    const { DEMO_GREETING } = await import("./demo/rosa-facts");
    return { audio: await speak(DEMO_GREETING[data.lang], data.voiceToken) };
  });
