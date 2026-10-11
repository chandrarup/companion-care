import { useState } from "react";
import { X, Check } from "lucide-react";
import { addDemoNote } from "@/lib/demo/log-store";
import { useT } from "@/i18n/I18nProvider";
import { DemoVoicePanel, VoiceToggleButton } from "./DemoVoicePanel";

const T = {
  en: {
    title: "Add daily log",
    subtitle: "A quick daily check-in about Rosa.",
    moodQ: "How is Rosa overall today?",
    moods: ["Hard day", "Off", "Okay", "Good", "Bright"],
    sleepQ: "How did she sleep last night?",
    sleeps: { well: "Well", okay: "Okay", poorly: "Poorly" },
    symptomQ: "Any symptoms today?",
    yes: "Yes — log an episode",
    no: "No, nothing today",
    noteQ: "Anything else worth noting? (optional)",
    notePlaceholder: "A line or two — what you noticed today…",
    save: "Save daily log",
    saved: "Daily log saved",
    savedBody: "It's part of Rosa's pattern now.",
    close: "Close",
    next: "Save and add episode",
  },
  es: {
    title: "Anotar el día",
    subtitle: "Un breve registro diario sobre Rosa.",
    moodQ: "¿Cómo está Rosa en general hoy?",
    moods: ["Día difícil", "Apagada", "Regular", "Bien", "Radiante"],
    sleepQ: "¿Cómo durmió anoche?",
    sleeps: { well: "Bien", okay: "Regular", poorly: "Mal" },
    symptomQ: "¿Algún síntoma hoy?",
    yes: "Sí — registrar episodio",
    no: "No, nada hoy",
    noteQ: "¿Algo más para anotar? (opcional)",
    notePlaceholder: "Una o dos líneas — lo que notaste hoy…",
    save: "Guardar registro",
    saved: "Registro guardado",
    savedBody: "Ya forma parte del patrón de Rosa.",
    close: "Cerrar",
    next: "Guardar y registrar episodio",
  },
} as const;

export function DemoCaregiverDailyLogForm({
  onClose,
  onOpenEpisode,
}: {
  onClose: () => void;
  onOpenEpisode: () => void;
}) {
  const { lang } = useT();
  const L = (lang as "en" | "es") === "es" ? "es" : "en";
  const txt = T[L];

  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [sleep, setSleep] = useState<"well" | "okay" | "poorly" | null>(null);
  const [hasSymptoms, setHasSymptoms] = useState<boolean | null>(null);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);

  const canSave = mood != null || sleep != null || hasSymptoms != null || note.trim().length > 0;

  function persist() {
    addDemoNote({
      source: "caregiver",
      mood,
      sleep,
      symptom: hasSymptoms ? (L === "es" ? "Síntomas presentes" : "Symptoms present") : undefined,
      note,
    });
  }

  function saveOnly() {
    persist();
    setDone(true);
  }

  function saveAndEpisode() {
    persist();
    onClose();
    onOpenEpisode();
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
            <p className="mt-1 text-sm text-muted-foreground">{txt.subtitle}</p>

            {voiceMode ? (
              <DemoVoicePanel
                mode="caregiverDaily"
                source="caregiver"
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
                      className={`rounded-xl border-2 py-3 text-xs font-medium min-h-[64px] ${active ? "border-primary bg-primary/10" : "border-border"}`}>
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
                      className={`rounded-xl border-2 py-3 text-base font-medium min-h-[56px] ${active ? "border-primary bg-primary/10" : "border-border"}`}>
                      {txt.sleeps[s]}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-5">
              <p className="text-lg font-medium">{txt.symptomQ}</p>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setHasSymptoms(true)}
                  className={`rounded-xl border-2 py-3 text-base font-semibold min-h-[56px] ${hasSymptoms === true ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  {txt.yes}
                </button>
                <button
                  type="button"
                  onClick={() => setHasSymptoms(false)}
                  className={`rounded-xl border-2 py-3 text-base font-semibold min-h-[56px] ${hasSymptoms === false ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  {txt.no}
                </button>
              </div>
            </section>

            <section className="mt-5">
              <p className="text-lg font-medium">{txt.noteQ}</p>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={txt.notePlaceholder}
                className="mt-2 w-full rounded-xl border-2 border-border bg-card p-3 text-base min-h-[100px]" />
            </section>

            {hasSymptoms === true ? (
              <button onClick={saveAndEpisode}
                className="mt-6 w-full rounded-2xl bg-primary text-primary-foreground py-4 text-lg font-semibold">
                {txt.next}
              </button>
            ) : (
              <button onClick={saveOnly} disabled={!canSave}
                className="mt-6 w-full rounded-2xl bg-primary text-primary-foreground py-4 text-lg font-semibold disabled:opacity-50">
                {txt.save}
              </button>
            )}
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
