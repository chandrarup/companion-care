import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mic as MicIcon } from "lucide-react";
import { extractLogFromTranscript } from "@/lib/daily-log.functions";
import { DailyLogForm, type DailyLogFormValue } from "./DailyLogForm";

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

function getRecognition(): RecognitionLike | null {
  const w = window as any;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  return new Ctor() as RecognitionLike;
}

export function VoiceLogger({
  onConfirm,
  submitting,
  language = "en-US",
}: {
  onConfirm: (v: DailyLogFormValue) => void;
  submitting?: boolean;
  language?: string;
}) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [extracted, setExtracted] = useState<DailyLogFormValue | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<RecognitionLike | null>(null);
  const extractFn = useServerFn(extractLogFromTranscript);

  useEffect(() => {
    const rec = getRecognition();
    if (!rec) {
      setSupported(false);
      return;
    }
    rec.lang = language;
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      if (finalText) setTranscript((t) => (t ? t + " " : "") + finalText.trim());
      setInterim(interimText);
    };
    rec.onerror = (e: any) => {
      setError(e?.error ? String(e.error) : "Speech error");
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };
    recRef.current = rec;
    return () => {
      try {
        rec.stop();
      } catch {}
    };
  }, [language]);

  function toggle() {
    setError(null);
    const rec = recRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      return;
    }
    setTranscript("");
    setInterim("");
    setExtracted(null);
    try {
      rec.start();
      setListening(true);
    } catch (e: any) {
      setError(e?.message ?? "Could not start microphone");
    }
  }

  async function runExtract() {
    if (!transcript.trim()) return;
    setExtracting(true);
    setError(null);
    try {
      const res = await extractFn({ data: { transcript } });
      setExtracted({
        mood: res.mood ?? null,
        sleep_quality: null,
        sleep_hours: null,
        caregiver_distress: null,
        notes: res.summary ?? transcript,
        symptoms: res.symptoms.map((s: any) => ({
          symptom: s.symptom,
          time_of_day: s.time_of_day ?? null,
          antecedent: s.antecedent ?? null,
          intervention_tried: s.intervention_tried ?? null,
          outcome: s.outcome ?? null,
        })),
      });
    } catch (e: any) {
      setError(e?.message ?? "Extraction failed");
    } finally {
      setExtracting(false);
    }
  }

  if (!supported) {
    return (
      <div className="rounded-md border p-4 text-base">
        Voice input isn't supported in this browser. Use the tap form instead.
      </div>
    );
  }

  if (extracted) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Review the extracted details. Edit any field, then confirm to save.
        </p>
        <DailyLogForm
          initial={extracted}
          submitting={submitting}
          submitLabel="Confirm & save"
          onSubmit={onConfirm}
          onCancel={() => setExtracted(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-pressed={listening}
          aria-label={listening ? "Stop recording" : "Start voice log"}
          className={`rounded-full flex items-center justify-center text-4xl border-4 ${
            listening
              ? "bg-destructive text-destructive-foreground border-destructive"
              : "bg-primary text-primary-foreground border-primary"
          }`}
          style={{ width: 120, height: 120 }}
        >
          {listening ? <span aria-hidden style={{ width: 28, height: 28, background: "currentColor", borderRadius: 4, display: "block" }} /> : <MicIcon size={44} strokeWidth={1.75} aria-hidden />}
        </button>
        <span className="text-sm text-muted-foreground">
          {listening ? "Listening… tap to stop" : "Tap and speak one sentence"}
        </span>
      </div>

      <div
        className="min-h-24 rounded-md border p-3 bg-muted/30"
        style={{ fontSize: "22pt", lineHeight: 1.3 }}
        aria-live="polite"
      >
        {transcript}
        {interim && <span className="opacity-60"> {interim}</span>}
        {!transcript && !interim && (
          <span className="opacity-50">Your words will appear here…</span>
        )}
      </div>

      {error && (
        <div className="text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={!transcript.trim() || extracting || listening}
        onClick={runExtract}
        className="w-full rounded-md bg-primary text-primary-foreground px-4 py-3 font-medium min-h-12 disabled:opacity-50"
      >
        {extracting ? "Extracting…" : "Extract details"}
      </button>
    </div>
  );
}