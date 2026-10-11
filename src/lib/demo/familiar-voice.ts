import { useEffect, useState, useCallback } from "react";
import { demoSpeak } from "@/lib/demo-voice.functions";
import { playAudioB64, playAudioUrl, unlockAudio, stopCaregiverSpeech } from "@/lib/caregiver-voice";
import { getActiveDemoVoiceToken, withClientTimeout } from "./demo-voice";
import { isVoiceMood, type Emotion, type VoiceMood } from "../voice-emotion";

const CLIP_KEY = "demo.familiarVoice.clip";
const NAME_KEY = "demo.familiarVoice.name";
const ENABLED_KEY = "demo.familiarVoice.enabled";
const EMOTION_KEY = "demo.familiarVoice.emotion";

type Listener = () => void;
const listeners = new Set<Listener>();
const emit = () => { for (const fn of listeners) fn(); };

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    if (v == null) return fallback;
    return JSON.parse(v) as T;
  } catch { return fallback; }
}
function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
  emit();
}

/** The emotion the visitor picked for the demo voice (default warm). Safe to call outside React. */
export function getDemoMood(): VoiceMood {
  const v = read<string>(EMOTION_KEY, "auto");
  return isVoiceMood(v) ? v : "auto";
}

/** For lines with no question to read a mood from (reminders, previews): "auto" means the warm default. */
export function getDemoEmotion(): Emotion | undefined {
  const m = getDemoMood();
  return m === "auto" ? undefined : m;
}

export function useFamiliarVoice() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const clipUrl = read<string | null>(CLIP_KEY, null);
  const caregiverName = read<string>(NAME_KEY, "María");
  const enabled = read<boolean>(ENABLED_KEY, true);
  const emotion = getDemoMood();

  return {
    clipUrl,
    caregiverName,
    enabled,
    emotion,
    setEmotion: useCallback((v: VoiceMood) => write(EMOTION_KEY, v), []),
    setClipUrl: useCallback((v: string | null) => write(CLIP_KEY, v), []),
    setCaregiverName: useCallback((v: string) => write(NAME_KEY, v), []),
    setEnabled: useCallback((v: boolean) => write(ENABLED_KEY, v), []),
  };
}

let currentAudio: HTMLAudioElement | null = null;
let currentUtter: SpeechSynthesisUtterance | null = null;

export function stopFamiliarVoice() {
  stopCaregiverSpeech();
  try { currentAudio?.pause(); currentAudio = null; } catch {}
  try { window.speechSynthesis?.cancel(); currentUtter = null; } catch {}
}

function speakWithTTS(text: string, lang: "en" | "es") {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "es" ? "es-ES" : "en-US";
    u.rate = 0.92;
    u.pitch = 1.05;
    const voices = synth.getVoices();
    const preferred = voices.find(
      (v) => v.lang.startsWith(u.lang.slice(0, 2)) && /female|maria|mónica|monica|paulina|samantha/i.test(v.name)
    ) || voices.find((v) => v.lang.startsWith(u.lang.slice(0, 2)));
    if (preferred) u.voice = preferred;
    currentUtter = u;
    synth.cancel();
    synth.speak(u);
  } catch {}
}

function playLegacyReminder(opts: {
  text: string;
  lang: "en" | "es";
  clipUrl?: string | null;
  enabled?: boolean;
}) {
  const { text, lang, clipUrl, enabled = true } = opts;
  if (!enabled) { speakWithTTS(text, lang); return; }
  stopFamiliarVoice();
  if (clipUrl) {
    try {
      const audio = new Audio(clipUrl);
      currentAudio = audio;
      audio.onended = () => speakWithTTS(text, lang);
      audio.onerror = () => speakWithTTS(text, lang);
      audio.play().catch(() => speakWithTTS(text, lang));
      return;
    } catch {
      speakWithTTS(text, lang);
      return;
    }
  }
  speakWithTTS(text, lang);
}

/**
 * Speak a reminder. Order: the visitor's own cloned voice (when "Use my voice" is on), then the recorded demo voice.
 * It never falls back to the browser's robot voice, so the patient only ever hears a voice that was chosen.
 * Resolves false when the browser blocked playback; the caller then shows a "Hear it" button (a tap always works).
 */
export async function playReminder(opts: { text: string; fallbackUrl: string; enabled?: boolean }): Promise<boolean> {
  const emotion = getDemoEmotion();
  stopFamiliarVoice();
  unlockAudio();
  const token = getActiveDemoVoiceToken();
  if (opts.enabled !== false && token) {
    try {
      const r = await withClientTimeout(demoSpeak({ data: { token, text: opts.text.slice(0, 200), emotion } }), 9000);
      if (r.audio && (await playAudioB64(r.audio))) return true;
    } catch {/* use the recorded demo voice */}
  }
  return playAudioUrl(opts.fallbackUrl);
}
