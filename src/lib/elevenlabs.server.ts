// ElevenLabs REST helpers (Instant Voice Clone + text-to-speech).
// Docs: POST /v1/voices/add (multipart), POST /v1/text-to-speech/{voice_id}. Auth header: xi-api-key.
const BASE = "https://api.elevenlabs.io/v1";
export const TTS_MODEL = "eleven_multilingual_v2"; // English + Spanish (fallback model)
import { DEFAULT_EMOTION, type Emotion } from "./voice-emotion";

export const hasElevenLabsKey = () => !!process.env.ELEVENLABS_API_KEY;

function key() {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error("Missing ELEVENLABS_API_KEY");
  return k;
}

export async function cloneVoice(name: string, files: { bytes: Uint8Array; type: string; filename: string }[]) {
  const form = new FormData();
  form.append("name", name);
  form.append("remove_background_noise", "true");
  form.append("description", "Caregiver voice for Companion Care");
  for (const f of files) form.append("files", new Blob([f.bytes as BlobPart], { type: f.type }), f.filename);
  const resp = await fetch(`${BASE}/voices/add`, { method: "POST", headers: { "xi-api-key": key() }, body: form, signal: AbortSignal.timeout(60_000) });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`ElevenLabs clone failed (${resp.status}): ${txt.slice(0, 300)}`);
  }
  return (await resp.json()) as { voice_id: string; requires_verification?: boolean };
}

export async function deleteVoice(voiceId: string) {
  await fetch(`${BASE}/voices/${encodeURIComponent(voiceId)}`, { method: "DELETE", headers: { "xi-api-key": key() }, signal: AbortSignal.timeout(15_000) }).catch(() => {});
}

const cache = new Map<string, string>();

// Eleven v3 reads bracketed audio tags as direction (they are not spoken aloud), which is how emotion is set.
const V3_MODEL = "eleven_v3";
const V3_TAG: Record<Emotion, string> = { warm: "[warmly]", calm: "[calmly]", cheerful: "[cheerfully]", gentle: "[softly]" };
// Fallback (multilingual v2) has no tags, so emotion is approximated with stability, style and speed.
const V2_SETTINGS: Record<Emotion, Record<string, number | boolean>> = {
  warm: { stability: 0.5, similarity_boost: 0.8, style: 0.25, speed: 0.92, use_speaker_boost: true },
  calm: { stability: 0.7, similarity_boost: 0.8, style: 0.0, speed: 0.88, use_speaker_boost: true },
  cheerful: { stability: 0.4, similarity_boost: 0.8, style: 0.4, speed: 0.96, use_speaker_boost: true },
  gentle: { stability: 0.65, similarity_boost: 0.8, style: 0.1, speed: 0.88, use_speaker_boost: true },
};

async function tts(voiceId: string, body: Record<string, unknown>, ms: number): Promise<string> {
  const resp = await fetch(`${BASE}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": key(), "Content-Type": "application/json", Accept: "audio/mpeg" },
    signal: AbortSignal.timeout(ms),
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`ElevenLabs TTS failed (${resp.status}): ${(await resp.text()).slice(0, 300)}`);
  return Buffer.from(await resp.arrayBuffer()).toString("base64");
}

/**
 * Returns base64 mp3 spoken with the chosen emotion. Tries Eleven v3 (expressive, ~2s) and falls back to
 * multilingual v2 with matching settings, so a slow or refused v3 call never costs the caller its audio.
 * Small in-memory cache so repeated lines don't burn quota.
 */
export async function synthesize(voiceId: string, text: string, emotion: Emotion = DEFAULT_EMOTION): Promise<string> {
  const ck = `${voiceId}|${emotion}|${text}`;
  const hit = cache.get(ck);
  if (hit) return hit;
  let b64: string;
  try {
    b64 = await tts(voiceId, { text: `${V3_TAG[emotion]} ${text}`, model_id: V3_MODEL, voice_settings: { stability: 0.5, similarity_boost: 0.8 } }, 4500);
  } catch (e) {
    console.warn(`[elevenlabs] v3 (${emotion}) unavailable, using v2: ${(e as Error).message.slice(0, 120)}`);
    b64 = await tts(voiceId, { text, model_id: TTS_MODEL, voice_settings: V2_SETTINGS[emotion] }, 8000);
  }
  if (cache.size >= 100) cache.delete(cache.keys().next().value as string);
  cache.set(ck, b64);
  return b64;
}
