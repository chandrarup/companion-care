import { useState } from "react";
import { X, Check } from "lucide-react";
import { addDemoNote } from "@/lib/demo/log-store";
import { useT } from "@/i18n/I18nProvider";
import { DemoVoicePanel, VoiceToggleButton } from "./DemoVoicePanel";

const T = {
  en: {
    title: "How are you, Rosa?",
    moodQ: "How's your mood?",
    moods: ["😟 Not great", "😐 Okay", "🙂 Good", "😊 Great", "😄 Wonderful"],
    sleepQ: "How did you sleep?",
    sleeps: { well: "Well", okay: "Okay", poorly: "Poorly" },
    symptomQ: "Anything bothering you? (optional)",
    symptoms: ["Confused", "Sad", "Tired", "Restless", "Nothing"],
    noteQ: "Anything else? (optional)",
    notePlaceholder: "Type a few words…",
    save: "Save",
    saved: "Thank you, Rosa",
    savedBody: "Your caregiver will see this.",
    close: "Close",
  },
  es: {
    title: "¿Cómo estás, Rosa?",
    moodQ: "¿Cómo es tu ánimo?",
    moods: ["😟 Mal", "😐 Regular", "🙂 Bien", "😊 Muy bien", "😄 Excelente"],
    sleepQ: "¿Cómo dormiste?",
    sleeps: { well: "Bien", okay: "Regular", poorly: "Mal" },
    symptomQ: "¿Algo te molesta? (opcional)",
    symptoms: ["Confundida", "Triste", "Cansada", "Inquieta", "Nada"],
    noteQ: "¿Algo más? (opcional)",
    notePlaceholder: "Escribe unas palabras…",
    save: "Guardar",
    saved: "Gracias, Rosa",
    savedBody: "Tu cuidadora lo verá.",
    close: "Cerrar",
  },
} as const;

export function DemoPatientLogForm({ onClose }: { onClose: () => void }) {
  const { lang } = useT();
  const L = (lang as "en" | "es") === "es" ? "es" : "en";
  const txt = T[L];

  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [sleep, setSleep] = useState<"well" | "okay" | "poorly" | null>(null);
  const [symptom, setSymptom] = useState<string>("");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);

  function save() {
    addDemoNote({ source: "patient", mood, sleep, symptom: symptom || undefined, note });
    setDone(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 p-2 sm:p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-card text-card-foreground border border-border p-6 relative">
        <button onClick={onClose} aria-label={txt.close} className="absolute right-3 top-3 p-1 rounded bg-muted">
          <X size={18} />
        </button>

        {!done ? (
          <>
            <h2 className="text-2xl font-semibold pr-8">{txt.title}</h2>

            {voiceMode ? (
              <DemoVoicePanel
                mode="patientNote"
                source="patient"
                onBack={() => setVoiceMode(false)}
                onClose={onClose}
              />
            ) : (
              <>
            <VoiceToggleButton
              onClick={() => setVoiceMode(true)}
              label={L === "es" ? "🎤 Hablar en vez de tocar" : "🎤 Use voice instead"}
            />

            <section className="mt-5">
              <p className="text-lg font-medium">{txt.moodQ}</p>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {txt.moods.map((label, i) => {
                  const v = (i + 1) as 1 | 2 | 3 | 4 | 5;
                  const active = mood === v;
                  return (
                    <button key={v} type="button" onClick={() => setMood(v)}
                      className={`rounded-xl border-2 py-3 text-xs font-medium ${active ? "border-primary bg-primary/10" : "border-border"}`}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-5">
              <p className="text-lg font-medium">{txt.sleepQ}</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(["well", "okay", "poorly"] as const).map((s) => {
                  const active = sleep === s;
                  return (
                    <button key={s} type="button" onClick={() => setSleep(s)}
                      className={`rounded-xl border-2 py-3 text-base font-medium ${active ? "border-primary bg-primary/10" : "border-border"}`}>
                      {txt.sleeps[s]}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-5">
              <p className="text-lg font-medium">{txt.symptomQ}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {txt.symptoms.map((s) => {
                  const active = symptom === s;
                  return (
                    <button key={s} type="button" onClick={() => setSymptom(active ? "" : s)}
                      className={`rounded-full border-2 px-3 py-2 text-sm font-medium ${active ? "border-primary bg-primary/10" : "border-border"}`}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-5">
              <p className="text-lg font-medium">{txt.noteQ}</p>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={txt.notePlaceholder}
                className="mt-2 w-full rounded-xl border-2 border-border bg-card p-3 text-base min-h-[100px]" />
            </section>

            <button onClick={save} disabled={mood == null && sleep == null && !symptom && !note.trim()}
              className="mt-6 w-full rounded-2xl bg-primary text-primary-foreground py-4 text-lg font-semibold disabled:opacity-50">
              {txt.save}
            </button>
              </>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <div className="mx-auto h-16 w-16 rounded-full bg-tint text-tint-foreground inline-flex items-center justify-center">
              <Check size={32} strokeWidth={2.5} />
            </div>
            <p className="mt-4 text-2xl font-semibold">{txt.saved}</p>
            <p className="mt-1 text-muted-foreground">{txt.savedBody}</p>
            <button onClick={onClose} className="mt-6 w-full rounded-2xl bg-primary text-primary-foreground py-4 text-lg font-semibold">{txt.close}</button>
          </div>
        )}
      </div>
    </div>
  );
}