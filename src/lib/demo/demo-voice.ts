import { useCallback, useEffect, useState } from "react";

// A visitor's temporary cloned voice (ElevenLabs) is represented only by a signed 3-hour token kept in this browser.
const TOKEN_KEY = "demo.voiceToken";
const NAME_KEY = "demo.voiceName";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function getDemoVoiceToken(): string | undefined {
  try { return window.localStorage.getItem(TOKEN_KEY) || undefined; } catch { return undefined; }
}
export function setDemoVoice(token: string | null, name?: string) {
  try {
    if (token) { window.localStorage.setItem(TOKEN_KEY, token); if (name) window.localStorage.setItem(NAME_KEY, name); }
    else { window.localStorage.removeItem(TOKEN_KEY); window.localStorage.removeItem(NAME_KEY); }
  } catch {}
  emit();
}

export function useDemoVoice() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  const token = getDemoVoiceToken();
  let name = "";
  try { name = window.localStorage.getItem(NAME_KEY) || ""; } catch {}
  return { token, name, set: useCallback(setDemoVoice, []) };
}

/** Reject if a promise takes too long (the demo must never hang). */
export const withClientTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

/** The visitor's voice token, only if "Use my voice" is switched on. This is what Talk, the greeting and reminders use. */
export function getActiveDemoVoiceToken(): string | undefined {
  try {
    const on = JSON.parse(window.localStorage.getItem("demo.familiarVoice.enabled") ?? "true");
    return on === false ? undefined : getDemoVoiceToken();
  } catch {
    return getDemoVoiceToken();
  }
}
