import { useEffect, useRef, useState } from "react";
import { Mic, Play, Check, ArrowLeft } from "lucide-react";
import { addDemoNote, addDemoEpisode } from "@/lib/demo/log-store";
import { useT } from "@/i18n/I18nProvider";

type Mode = "patientNote" | "caregiverDaily" | "episode";

type Extracted = {
  // shared
  mood?: 1 | 2 | 3 | 4 | 5;
  sleep?: "well" | "okay" | "poorly";
  symptom?: string;
  note?: string;
  // episode
  timeOfDay?: string;
  antecedent?: string;
  intervention?: string;
  outcome?: string;
};

type Sample = {
  id: string;
  transcript: { en: string; es: string };
  extracted: Extracted;
};

// Spanish display for the fixed English values the sample voice notes extract.
const ES_EXTRACTED: Record<string, string> = {
  Confused: "Confusión", Confusion: "Confusión", Tired: "Cansancio", Restless: "Inquietud", Sad: "Tristeza",
  wandering: "Deambular", agitation: "Agitación", confusion: "Confusión",
  "Feeling a little confused today.": "Hoy se siente un poco confundida.",
  "Peaceful morning, calm.": "Mañana tranquila, en calma.",
  "Hard morning, asked about the children repeatedly.": "Mañana difícil, preguntó varias veces por los niños.",
  "Good day, slept well, ate everything, no episodes.": "Buen día: durmió bien, comió todo, sin episodios.",
};

const SAMPLES: Record<Mode, Sample[]> = {
  patientNote: [
    {
      id: "p1",
      transcript: {
        en: "I slept okay but I feel a little confused today.",
        es: "Dormí bien pero hoy me siento un poco confundida.",
      },
      extracted: { mood: 2, sleep: "okay", symptom: "Confused", note: "Feeling a little confused today." },
    },
    {
      id: "p2",
      transcript: {
        en: "I had a peaceful morning. I feel calm and a little tired.",
        es: "Tuve una mañana tranquila. Me siento en calma y un poco cansada.",
      },
      extracted: { mood: 3, sleep: "well", symptom: "Tired", note: "Peaceful morning, calm." },
    },
  ],
  caregiverDaily: [
    {
      id: "c1",
      transcript: {
        en: "She had a hard morning, didn't sleep well, asked about the children a lot.",
        es: "Tuvo una mañana difícil, no durmió bien, preguntó mucho por los niños.",
      },
      extracted: { mood: 2, sleep: "poorly", symptom: "Confusion", note: "Hard morning, asked about the children repeatedly." },
    },
    {
      id: "c2",
      transcript: {
        en: "Rosa had a good day today, slept well, ate everything, no episodes.",
        es: "Rosa tuvo un buen día, durmió bien, comió todo, sin episodios.",
      },
      extracted: { mood: 4, sleep: "well", note: "Good day, slept well, ate everything, no episodes." },
    },
  ],
  episode: [
    {
      id: "e1",
      transcript: {
        en: "She got restless around 3 this afternoon, kept asking about the children. I put on her Vicente Fernández and she settled.",
        es: "Se puso inquieta como a las 3 de la tarde, preguntaba por los niños. Le puse Vicente Fernández y se calmó.",
      },
      extracted: {
        symptom: "agitation",
        timeOfDay: "afternoon",
        antecedent: "understimulation",
        intervention: "Vicente Fernández music",
        outcome: "helped",
      },
    },
    {
      id: "e2",
      transcript: {
        en: "She wandered to the front door in the evening after dinner. I walked with her to the garden and she calmed down.",
        es: "Se fue a la puerta de la calle por la noche después de cenar. Caminé con ella al jardín y se calmó.",
      },
      extracted: {
        symptom: "wandering",
        timeOfDay: "evening",
        antecedent: "environment_change",
        intervention: "Walk in the garden",
        outcome: "helped",
      },
    },
  ],
};

const TXT = {
  en: {
    promptPatient: "Tell me how you're feeling.",
    promptCaregiver: "Tell me about Rosa's day in your own words.",
    promptEpisode: "Describe what happened in your own words.",
    tapMic: "Tap the microphone and speak",
    listening: "Listening…",
    samples: "Or tap a sample to try it",
    transcript: "You said",
    extracted: "What we captured",
    save: "Save",
    back: "Back to tap mode",
    notSupported: "Voice input isn't available on this device — tap a sample below.",
    fields: {
      mood: "Mood",
      sleep: "Sleep",
      symptom: "Symptom",
      note: "Note",
      timeOfDay: "When",
      antecedent: "Before",
      intervention: "What you tried",
      outcome: "Result",
    },
    moods: ["Hard", "Off", "Okay", "Good", "Bright"],
    sleeps: { well: "Well", okay: "Okay", poorly: "Poorly" },
  },
  es: {
    promptPatient: "Cuéntame cómo te sientes.",
    promptCaregiver: "Cuéntame del día de Rosa con tus palabras.",
    promptEpisode: "Describe lo que pasó con tus palabras.",
    tapMic: "Toca el micrófono y habla",
    listening: "Escuchando…",
    samples: "O toca un ejemplo para probarlo",
    transcript: "Dijiste",
    extracted: "Lo que capturamos",
    save: "Guardar",
    back: "Volver al modo táctil",
    notSupported: "La entrada por voz no está disponible aquí — toca un ejemplo abajo.",
    fields: {
      mood: "Ánimo",
      sleep: "Sueño",
      symptom: "Síntoma",
      note: "Nota",
      timeOfDay: "Cuándo",
      antecedent: "Antes",
      intervention: "Qué intentaste",
      outcome: "Resultado",
    },
    moods: ["Difícil", "Apagada", "Regular", "Bien", "Radiante"],
    sleeps: { well: "Bien", okay: "Regular", poorly: "Mal" },
  },
} as const;

function fieldsForMode(mode: Mode): (keyof Extracted)[] {
  if (mode === "episode") return ["symptom", "timeOfDay", "antecedent", "intervention", "outcome"];
  if (mode === "caregiverDaily") return ["mood", "sleep", "symptom", "note"];
  return ["mood", "sleep", "symptom", "note"];
}

export function DemoVoicePanel({
  mode,
  source,
  onBack,
  onClose,
}: {
  mode: Mode;
  source: "caregiver" | "patient";
  onBack: () => void;
  onClose: () => void;
}) {
  const { lang } = useT();
  const L = (lang as "en" | "es") === "es" ? "es" : "en";
  const t = TXT[L];

  const [transcript, setTranscript] = useState<string>("");
  const [extracted, setExtracted] = useState<Extracted>({});
  const [revealed, setRevealed] = useState<Set<keyof Extracted>>(new Set());
  const [listening, setListening] = useState(false);
  const [done, setDone] = useState(false);
  const recogRef = useRef<any>(null);
  const timersRef = useRef<number[]>([]);

  const SR = typeof window !== "undefined" ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;
  const supported = !!SR;

  useEffect(() => () => { timersRef.current.forEach((id) => window.clearTimeout(id)); }, []);

  const prompt =
    mode === "patientNote" ? t.promptPatient : mode === "caregiverDaily" ? t.promptCaregiver : t.promptEpisode;

  function animateReveal(ext: Extracted) {
    const keys = fieldsForMode(mode).filter((k) => ext[k] !== undefined && ext[k] !== "");
    setRevealed(new Set());
    setExtracted(ext);
    keys.forEach((k, i) => {
      const id = window.setTimeout(() => {
        setRevealed((prev) => {
          const n = new Set(prev);
          n.add(k);
          return n;
        });
      }, 350 + i * 450);
      timersRef.current.push(id);
    });
  }

  function pickSample(s: Sample) {
    setTranscript(s.transcript[L]);
    animateReveal(s.extracted);
  }

  function naiveExtract(text: string): Extracted {
    const lower = text.toLowerCase();
    const ext: Extracted = { note: text };
    if (mode !== "episode") {
      if (/(great|wonderful|bright|excelente|radiante)/.test(lower)) ext.mood = 5;
      else if (/(good|bien|muy bien)/.test(lower)) ext.mood = 4;
      else if (/(okay|ok|regular)/.test(lower)) ext.mood = 3;
      else if (/(off|apagad|tired|cansad)/.test(lower)) ext.mood = 2;
      else if (/(hard|bad|mal|dif[ií]cil)/.test(lower)) ext.mood = 1;
      if (/(slept well|durmi[oó] bien|sleep well)/.test(lower)) ext.sleep = "well";
      else if (/(slept okay|slept ok|durmi[oó] regular)/.test(lower)) ext.sleep = "okay";
      else if (/(didn'?t sleep|poor sleep|no durmi[oó]|durmi[oó] mal)/.test(lower)) ext.sleep = "poorly";
      if (/confus|confundid/.test(lower)) ext.symptom = "Confused";
      else if (/restless|inquiet|agitad/.test(lower)) ext.symptom = "Restless";
      else if (/sad|trist/.test(lower)) ext.symptom = "Sad";
      else if (/tired|cansad/.test(lower)) ext.symptom = "Tired";
    } else {
      if (/wander|se fue|puerta/.test(lower)) ext.symptom = "wandering";
      else if (/agitat|restless|inquiet/.test(lower)) ext.symptom = "agitation";
      else if (/confus/.test(lower)) ext.symptom = "confusion";
      if (/morning|mañana/.test(lower)) ext.timeOfDay = "morning";
      else if (/afternoon|tarde/.test(lower)) ext.timeOfDay = "afternoon";
      else if (/evening|noche|tonight/.test(lower)) ext.timeOfDay = "evening";
      else if (/night|madrugada/.test(lower)) ext.timeOfDay = "night";
      if (/music|m[uú]sica|fernández/.test(lower)) ext.intervention = "Music";
      else if (/walk|camin/.test(lower)) ext.intervention = "Walk";
      if (/settled|calm|se calm|helped|ayud/.test(lower)) ext.outcome = "helped";
      ext.antecedent = ext.antecedent ?? "unknown";
    }
    return ext;
  }

  function startListening() {
    if (!supported) return;
    try {
      const r = new SR();
      r.lang = L === "es" ? "es-ES" : "en-US";
      r.interimResults = true;
      r.continuous = false;
      let finalText = "";
      r.onresult = (e: any) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) finalText += res[0].transcript;
          else interim += res[0].transcript;
        }
        setTranscript((finalText + interim).trim());
      };
      r.onerror = () => setListening(false);
      r.onend = () => {
        setListening(false);
        if (finalText.trim()) animateReveal(naiveExtract(finalText));
      };
      recogRef.current = r;
      setTranscript("");
      setExtracted({});
      setRevealed(new Set());
      r.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  function stopListening() {
    try { recogRef.current?.stop(); } catch {/* noop */}
    setListening(false);
  }

  function save() {
    if (mode === "episode") {
      addDemoEpisode({
        source,
        symptom: extracted.symptom ?? "",
        timeOfDay: extracted.timeOfDay ?? "",
        antecedent: extracted.antecedent ?? "unknown",
        intervention: extracted.intervention ?? "",
        outcome: extracted.outcome ?? "",
        distress: null,
        flags: [],
      });
    } else {
      addDemoNote({
        source,
        mood: (extracted.mood ?? null) as any,
        sleep: extracted.sleep ?? null,
        symptom: extracted.symptom,
        note: extracted.note ?? transcript,
      });
    }
    setDone(true);
  }

  const canSave = Object.values(extracted).some((v) => v !== undefined && v !== "");
  const fields = fieldsForMode(mode);

  function renderValue(k: keyof Extracted): string {
    const v = extracted[k];
    if (v === undefined || v === "") return "—";
    if (k === "mood" && typeof v === "number") return t.moods[v - 1];
    if (k === "sleep" && typeof v === "string") return t.sleeps[v as "well" | "okay" | "poorly"];
    const text = String(v).replace(/_/g, " ");
    return L === "es" ? ES_EXTRACTED[text] ?? text : text;
  }

  if (done) {
    return (
      <div className="text-center py-8">
        <div className="mx-auto h-16 w-16 rounded-full bg-tint text-tint-foreground inline-flex items-center justify-center">
          <Check size={32} strokeWidth={2.5} />
        </div>
        <p className="mt-4 text-2xl font-semibold">{L === "es" ? "Guardado" : "Saved"}</p>
        <button onClick={onClose} className="mt-6 w-full rounded-2xl bg-primary text-primary-foreground py-4 text-lg font-semibold">
          {L === "es" ? "Cerrar" : "Close"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} /> {t.back}
      </button>

      <p className="mt-3 text-lg font-medium text-center">{prompt}</p>

      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={listening ? stopListening : startListening}
          disabled={!supported}
          aria-label={t.tapMic}
          className={`h-28 w-28 rounded-full flex items-center justify-center transition-all ${
            listening ? "bg-destructive" : "bg-primary"
          } ${!supported ? "opacity-50" : ""}`}
        >
          <Mic size={48} className="text-primary-foreground" />
        </button>
      </div>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        {!supported ? t.notSupported : listening ? t.listening : t.tapMic}
      </p>

      <div className="mt-5">
        <p className="text-sm font-medium text-muted-foreground">{t.samples}</p>
        <div className="mt-2 grid gap-2">
          {SAMPLES[mode].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => pickSample(s)}
              className="flex items-start gap-2 rounded-xl border-2 border-border bg-muted p-3 text-left text-sm hover:border-primary hover:bg-primary/5"
            >
              <Play size={16} className="mt-1 shrink-0 text-primary" />
              <span>"{s.transcript[L]}"</span>
            </button>
          ))}
        </div>
      </div>

      {transcript && (
        <div className="mt-5 rounded-xl bg-muted p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.transcript}</p>
          <p className="mt-1 text-base text-foreground">"{transcript}"</p>
        </div>
      )}

      {canSave && (
        <div className="mt-4 rounded-xl border-2 border-primary/30 bg-primary/5 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t.extracted}</p>
          <ul className="mt-2 space-y-1.5 text-base">
            {fields.map((k) => {
              const show = revealed.has(k);
              const has = extracted[k] !== undefined && extracted[k] !== "";
              if (!has) return null;
              return (
                <li
                  key={k}
                  className={`flex justify-between gap-2 transition-all duration-300 ${
                    show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
                  }`}
                >
                  <span className="text-muted-foreground">{t.fields[k as keyof typeof t.fields]}</span>
                  <span className="font-medium text-foreground text-right">{renderValue(k)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={save}
        disabled={!canSave}
        className="mt-6 w-full rounded-2xl bg-primary text-primary-foreground py-4 text-lg font-semibold disabled:opacity-50"
      >
        {t.save}
      </button>
    </div>
  );
}

export function VoiceToggleButton({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-primary/40 bg-primary/5 px-4 py-3 text-base font-semibold text-primary hover:bg-primary/10"
    >
      <Mic size={18} /> {label ?? "🎤 Use voice instead"}
    </button>
  );
}