import { useState } from "react";
import { X } from "lucide-react";
import { ANTECEDENT_OPTIONS, OUTCOME_OPTIONS, SYMPTOM_OPTIONS } from "@/lib/daily-log.functions";
import { RED_FLAGS } from "@/lib/episodes.functions";
import { addDemoEpisode } from "@/lib/demo/log-store";
import { useT } from "@/i18n/I18nProvider";
import { optionLabel } from "@/lib/demo/option-labels";
import { DemoVoicePanel, VoiceToggleButton } from "./DemoVoicePanel";

const TIMES_OF_DAY = ["morning", "afternoon", "evening", "night"] as const;
type Step = "symptom" | "when" | "antecedent" | "intervention" | "outcome" | "distress" | "flags" | "review" | "done";

const T = {
  en: {
    title: "Log a difficult moment",
    step: (n: number, total: number) => `Step ${n} of ${total}`,
    happened: "What happened?",
    when: "When?",
    before: "What happened right before?",
    tried: "What did you try?",
    triedPlaceholder: "Type what you tried (e.g. dim lights, music, walk)",
    next: "Next",
    didHelp: "Did it help?",
    distress: "How hard was this on you? (optional)",
    skip: "Skip",
    signs: "Any of these signs?",
    confirm: "Confirm and save",
    saving: "Saving…",
    saved: "Saved to today's log",
    savedBody: "It's now part of the pattern engine for Rosa.",
    close: "Close",
    back: "← Back",
    what: "What", whenL: "When", beforeL: "Before", triedL: "Tried", result: "Result", distressL: "Distress", signsL: "Signs",
  },
  es: {
    title: "Registrar un momento difícil",
    step: (n: number, total: number) => `Paso ${n} de ${total}`,
    happened: "¿Qué pasó?",
    when: "¿Cuándo?",
    before: "¿Qué pasó justo antes?",
    tried: "¿Qué intentaste?",
    triedPlaceholder: "Escribe lo que intentaste (ej. luces tenues, música, caminar)",
    next: "Siguiente",
    didHelp: "¿Ayudó?",
    distress: "¿Qué tan difícil fue para ti? (opcional)",
    skip: "Saltar",
    signs: "¿Alguna de estas señales?",
    confirm: "Confirmar y guardar",
    saving: "Guardando…",
    saved: "Guardado en el registro de hoy",
    savedBody: "Ya forma parte del motor de patrones de Rosa.",
    close: "Cerrar",
    back: "← Atrás",
    what: "Qué", whenL: "Cuándo", beforeL: "Antes", triedL: "Intentado", result: "Resultado", distressL: "Estrés", signsL: "Señales",
  },
} as const;


export function DemoEpisodeForm({ source, onClose }: { source: "caregiver" | "patient"; onClose: () => void }) {
  const { lang } = useT();
  const L = (lang as "en" | "es") === "es" ? "es" : "en";
  const txt = T[L];

  const [step, setStep] = useState<Step>("symptom");
  const [symptom, setSymptom] = useState<string>("");
  const [timeOfDay, setTimeOfDay] = useState<string>("");
  const [antecedent, setAntecedent] = useState<string>("");
  const [intervention, setIntervention] = useState<string>("");
  const [outcome, setOutcome] = useState<string>("");
  const [distress, setDistress] = useState<number | null>(null);
  const [flags, setFlags] = useState<string[]>([]);
  const [voiceMode, setVoiceMode] = useState(false);

  const order: Step[] = ["symptom", "when", "antecedent", "intervention", "outcome", "distress", "flags", "review"];
  const idx = order.indexOf(step);
  const next = () => setStep(order[Math.min(order.length - 1, idx + 1)]);
  const back = () => (idx <= 0 ? onClose() : setStep(order[idx - 1]));

  function toggleFlag(id: string) {
    setFlags((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function save() {
    addDemoEpisode({ source, symptom, timeOfDay, antecedent, intervention, outcome, distress, flags });
    setStep("done");
  }

  function BigGrid<U extends string>({ options, value, onPick, label }: { options: readonly U[]; value: string; onPick: (v: U) => void; label: (v: U) => string }) {
    return (
      <div className="grid grid-cols-2 gap-3" role="radiogroup">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={value === o}
            onClick={() => { onPick(o); next(); }}
            className={`min-h-14 rounded-lg border-2 px-3 py-3 text-base font-medium capitalize ${value === o ? "border-primary bg-primary/10" : "border-border bg-background"}`}
          >
            {label(o)}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 p-2 sm:p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-card p-5 sm:p-6 relative">
        <button onClick={onClose} aria-label={txt.close} className="absolute right-3 top-3 p-1 rounded hover:bg-muted">
          <X size={18} />
        </button>
        <h2 className="text-xl font-semibold pr-8">{txt.title}</h2>
        {step !== "done" && !voiceMode && <p className="mt-1 text-xs text-muted-foreground">{txt.step(idx + 1, order.length)}</p>}

        {voiceMode ? (
          <div className="mt-4">
            <DemoVoicePanel
              mode="episode"
              source={source}
              onBack={() => setVoiceMode(false)}
              onClose={onClose}
            />
          </div>
        ) : (
          <>
        {step !== "done" && (
          <VoiceToggleButton
            onClick={() => setVoiceMode(true)}
            label={L === "es" ? "🎤 Hablar en vez de tocar" : "🎤 Use voice instead"}
          />
        )}

        <div className="mt-5 space-y-5">
          {step === "symptom" && (
            <section><h3 className="text-lg font-semibold mb-3">{txt.happened}</h3>
              <BigGrid options={SYMPTOM_OPTIONS} value={symptom} onPick={setSymptom} label={(v) => optionLabel(v, L)} /></section>
          )}
          {step === "when" && (
            <section><h3 className="text-lg font-semibold mb-3">{txt.when}</h3>
              <BigGrid options={TIMES_OF_DAY} value={timeOfDay} onPick={setTimeOfDay} label={(v) => optionLabel(v, L)} /></section>
          )}
          {step === "antecedent" && (
            <section><h3 className="text-lg font-semibold mb-3">{txt.before}</h3>
              <BigGrid options={ANTECEDENT_OPTIONS} value={antecedent} onPick={setAntecedent} label={(v) => optionLabel(v, L)} /></section>
          )}
          {step === "intervention" && (
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">{txt.tried}</h3>
              <input
                type="text"
                value={intervention}
                onChange={(e) => setIntervention(e.target.value)}
                placeholder={txt.triedPlaceholder}
                className="w-full rounded border border-input bg-background px-3 py-3 min-h-12 text-base"
              />
              <button type="button" onClick={next} className="w-full rounded-md bg-primary text-primary-foreground px-4 py-3 min-h-12 font-medium">{txt.next}</button>
            </section>
          )}
          {step === "outcome" && (
            <section><h3 className="text-lg font-semibold mb-3">{txt.didHelp}</h3>
              <BigGrid options={OUTCOME_OPTIONS} value={outcome} onPick={setOutcome} label={(v) => optionLabel(v, L)} /></section>
          )}
          {step === "distress" && (
            <section>
              <h3 className="text-lg font-semibold mb-3">{txt.distress}</h3>
              <div className="grid grid-cols-5 gap-2" role="radiogroup">
                {[0, 1, 2, 3, 4].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={distress === n}
                    onClick={() => { setDistress(n); next(); }}
                    className={`min-h-14 rounded-lg border-2 text-xl font-medium ${distress === n ? "border-primary bg-primary/10" : "border-border bg-background"}`}>
                    {n}
                  </button>
                ))}
              </div>
              <button type="button" onClick={next} className="mt-3 w-full rounded-md border-2 border-border px-4 py-3 min-h-12 text-sm">{txt.skip}</button>
            </section>
          )}
          {step === "flags" && (
            <section className="space-y-2">
              <h3 className="text-lg font-semibold mb-1">{txt.signs}</h3>
              {RED_FLAGS.map((f) => (
                <label key={f.id} className="flex items-start gap-2 cursor-pointer rounded-md border border-border bg-background p-3">
                  <input type="checkbox" checked={flags.includes(f.id)} onChange={() => toggleFlag(f.id)} className="h-5 w-5 mt-1" />
                  <span>{optionLabel(f.id, L)}</span>
                </label>
              ))}
              <button type="button" onClick={next} className="w-full rounded-md bg-primary text-primary-foreground px-4 py-3 min-h-12 font-medium">{txt.next}</button>
            </section>
          )}
          {step === "review" && (
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">{txt.confirm}</h3>
              <ul className="rounded-md border border-border bg-background p-3 text-sm space-y-1">
                <li><b>{txt.what}:</b> {symptom ? optionLabel(symptom, L) : "—"}</li>
                <li><b>{txt.whenL}:</b> {timeOfDay ? optionLabel(timeOfDay, L) : "—"} ({new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })})</li>
                <li><b>{txt.beforeL}:</b> {antecedent ? optionLabel(antecedent, L) : "—"}</li>
                <li><b>{txt.triedL}:</b> {intervention || "—"}</li>
                <li><b>{txt.result}:</b> {outcome ? optionLabel(outcome, L) : "—"}</li>
                <li><b>{txt.distressL}:</b> {distress != null ? distress : "—"}</li>
                {flags.length > 0 && <li><b>{txt.signsL}:</b> {flags.join(", ")}</li>}
              </ul>
              <button type="button" onClick={save} className="w-full rounded-md bg-primary text-primary-foreground px-4 py-3 min-h-12 font-medium">
                {txt.confirm}
              </button>
            </section>
          )}
          {step === "done" && (
            <section className="text-center py-6">
              <div className="text-5xl mb-3">✅</div>
              <p className="text-lg font-semibold">{txt.saved}</p>
              <p className="text-sm text-muted-foreground mt-1">{txt.savedBody}</p>
              <button onClick={onClose} className="mt-5 w-full rounded-md bg-primary text-primary-foreground px-4 py-3 min-h-12 font-medium">{txt.close}</button>
            </section>
          )}
        </div>

        {step !== "done" && (
          <div className="flex gap-2 pt-4">
            <button type="button" onClick={back} className="rounded-md border-2 border-border px-4 py-3 min-h-12">{txt.back}</button>
            {step !== "review" && step !== "intervention" && step !== "distress" && step !== "flags" && (
              <button type="button" onClick={next} className="rounded-md border-2 border-border px-4 py-3 min-h-12">{txt.skip}</button>
            )}
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}