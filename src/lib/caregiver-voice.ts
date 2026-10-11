import { speakCaregiver } from "./voice.functions";

// One shared <audio> element. Browsers (Safari/iOS especially) only let a page start sound inside a tap; an element that
// was "unlocked" by a tap can then play later, e.g. when a reply arrives after a network call. unlockAudio() does that.
let shared: HTMLAudioElement | null = null;
let noVoiceUntil = 0; // skip server round-trips for a while after "no cloned voice"

const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAABErAAABAAgAZGF0YQAAAAA=";

function el() {
  if (!shared) shared = new Audio();
  return shared;
}

/** Call from a tap/click/keypress handler (opening Talk, sending a message). Safe to call repeatedly. */
export function unlockAudio() {
  try {
    const a = el();
    if (a.src && !a.paused) return; // already playing real audio
    a.src = SILENT_WAV;
    void a.play().catch(() => {});
  } catch {}
}

export function stopCaregiverSpeech() {
  try { shared?.pause(); } catch {}
}

async function playSrc(src: string): Promise<boolean> {
  try {
    const a = el();
    a.pause();
    a.src = src;
    a.currentTime = 0;
    await a.play();
    return true;
  } catch {
    return false;
  }
}

/** Play base64 mp3 returned by the server. Resolves false if the browser blocks/fails playback. */
export const playAudioB64 = (b64: string) => playSrc(`data:audio/mpeg;base64,${b64}`);

/** Play a static audio file (e.g. pre-generated demo audio). */
export const playAudioUrl = (url: string) => playSrc(url);

export type SpeechStatus = "ok" | "novoice" | "blocked";

/** Speak a short UI string in the household's cloned voice. "novoice": no cloned voice, so a browser voice is the right fallback. "blocked": the browser refused autoplay; retry on the next tap. */
export async function playCaregiverSpeechStatus(text: string): Promise<SpeechStatus> {
  if (!text || Date.now() < noVoiceUntil) return "novoice";
  try {
    const r = await speakCaregiver({ data: { text } });
    if (!r.audio) {
      noVoiceUntil = Date.now() + 60_000;
      return "novoice";
    }
    return (await playAudioB64(r.audio)) ? "ok" : "blocked";
  } catch {
    return "novoice";
  }
}

/** Speak a short UI string in the household's cloned voice. false => caller should use the browser voice. */
export async function playCaregiverSpeech(text: string): Promise<boolean> {
  return (await playCaregiverSpeechStatus(text)) === "ok";
}

/** Unlock audio on the first tap or key press anywhere, so reminders that fire by themselves can still be heard. */
let unlockInstalled = false;
export function installAudioUnlock(onFirstGesture?: () => void) {
  if (typeof window === "undefined") return () => {};
  const h = () => { unlockAudio(); onFirstGesture?.(); };
  window.addEventListener("pointerdown", h, true);
  window.addEventListener("keydown", h, true);
  unlockInstalled = true;
  return () => { window.removeEventListener("pointerdown", h, true); window.removeEventListener("keydown", h, true); };
}

export function resetCaregiverVoiceCache() {
  noVoiceUntil = 0;
}
