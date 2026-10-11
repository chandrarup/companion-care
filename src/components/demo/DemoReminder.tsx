import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, Volume2 } from "lucide-react";
import { DEMO_REMINDERS } from "@/lib/demo/data";
import { useT } from "@/i18n/I18nProvider";
import { useFamiliarVoice, playReminder, stopFamiliarVoice } from "@/lib/demo/familiar-voice";
import { unlockAudio } from "@/lib/caregiver-voice";
import { REMINDER_AUDIO_URL, reminderSpoken } from "@/lib/demo/reminder-text";


// Tiny module-level pub/sub so a "Show reminder" button anywhere in the demo can
// fire the reminder mounted by <DemoReminder /> without prop-drilling.
const triggerListeners = new Set<() => void>();
export function triggerDemoReminder() { unlockAudio(); for (const fn of triggerListeners) fn(); }

export function DemoShowReminderButton({ label, className }: { label: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={triggerDemoReminder}
      className={className ?? "inline-flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1.5 text-xs text-white/90 hover:bg-black/35"}
    >
      <Bell size={12} /> {label}
    </button>
  );
}

function playChime(soft: boolean) {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = soft ? 528 : 660;
    g.gain.value = 0.0001;
    o.connect(g); g.connect(ctx.destination);
    const now = ctx.currentTime;
    g.gain.exponentialRampToValueAtTime(soft ? 0.08 : 0.12, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, now + (soft ? 1.2 : 0.6));
    o.start(now); o.stop(now + 1.4);
  } catch {}
}

export function DemoReminder({ mode }: { mode: "patient" | "caregiver" }) {
  const { lang } = useT();
  const L = (lang as "en" | "es") === "es" ? "es" : "en";
  const { clipUrl, caregiverName, enabled: voiceEnabled } = useFamiliarVoice();
  const idxRef = useRef(0);
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false);

  const [blocked, setBlocked] = useState(false);

  const speakIt = useCallback((n: number) => {
    const r = DEMO_REMINDERS[n];
    // With the default caregiver name the recorded line is a perfect match; with a custom name only a cloned voice can say it.
    const text = reminderSpoken(r, L, caregiverName);
    setBlocked(false);
    void playReminder({ text, fallbackUrl: REMINDER_AUDIO_URL(r.id, L), enabled: voiceEnabled }).then((ok) => { if (!ok) setBlocked(true); });
  }, [L, caregiverName, voiceEnabled]);

  const fire = useCallback(() => {
    idxRef.current = (idxRef.current + 1) % DEMO_REMINDERS.length;
    const next = idxRef.current;
    setIdx(next);
    setOpen(true);
    playChime(mode === "patient");
    if (mode === "patient") speakIt(next);
  }, [mode, speakIt]);

  useEffect(() => {
    // Manual only ("Show reminder" button). The old 2-minute auto-fire interrupted live walkthroughs.
    triggerListeners.add(fire);
    return () => {
      triggerListeners.delete(fire);
    };
  }, [fire]);

  const r = useMemo(() => DEMO_REMINDERS[idx], [idx]);

  if (mode === "caregiver") {
    return (
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}
              className="fixed top-3 right-3 z-40 w-80 max-w-[90vw] rounded-xl border border-border bg-card p-4"
              role="status"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl" aria-hidden>{r.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{r.title[L]}</p>
                  <p className="text-sm text-muted-foreground">{r.body[L]}</p>
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    {L === "es" ? `Se reproduce con la voz de ${caregiverName}` : `Plays in ${caregiverName}'s voice`}
                  </p>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted-foreground hover:text-foreground" aria-label="Dismiss">✕</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/95"
            >
              <motion.div
                initial={{ scale: 0.9, y: 10 }} animate={{ scale: 1, y: 0 }}
                className="w-full max-w-md rounded-3xl bg-card border border-border p-8 text-center text-foreground"
              >
                <div className="text-7xl mb-4" aria-hidden>{r.emoji}</div>
                <h2 className="text-3xl font-semibold">{r.title[L]}</h2>
                <p className="mt-3 text-lg text-muted-foreground">{r.body[L]}</p>
                <p className="mt-2 text-sm text-muted-foreground italic">
                  {L === "es" ? `— ${caregiverName}` : `— ${caregiverName}`}
                </p>
                <button
                  type="button"
                  onClick={() => speakIt(idx)}
                  className={"mt-6 w-full rounded-2xl border-2 border-foreground bg-card text-foreground text-xl font-semibold py-4 inline-flex items-center justify-center gap-3 " + (blocked ? "" : "opacity-90")}
                >
                  <Volume2 size={24} />
                  {blocked ? (L === "es" ? "Toca para escuchar" : "Tap to hear") : (L === "es" ? "Escuchar otra vez" : "Hear again")}
                </button>
                <button
                  type="button"
                  onClick={() => { stopFamiliarVoice(); setOpen(false); }}
                  className="mt-4 w-full rounded-2xl bg-primary text-primary-foreground text-2xl font-medium py-5 inline-flex items-center justify-center gap-3 active:scale-[0.99]"
                >
                  <Check size={28} strokeWidth={2.5} />
                  {L === "es" ? "Listo" : "Done"}
                </button>
              </motion.div>
            </motion.div>
          )}
    </AnimatePresence>
  );
}
