import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ANTECEDENT_OPTIONS,
  OUTCOME_OPTIONS,
  SYMPTOM_OPTIONS,
} from "@/lib/daily-log.functions";
import { RED_FLAGS, createEpisode } from "@/lib/episodes.functions";
import { MUSIC_TRIGGER_SYMPTOMS } from "@/lib/music.functions";
import { MusicTrigger } from "@/components/MusicTrigger";

const TIMES_OF_DAY = ["morning", "afternoon", "evening", "night"] as const;
type Step = "symptom" | "when" | "antecedent" | "intervention" | "outcome" | "distress" | "flags" | "review";

function humanize(s: string) {
  return s.replace(/_/g, " ");
}

export function EpisodeForm({
  onSaved,
  onCancel,
  calmingSuggestions = [],
}: {
  onSaved: (result: { id: string; red_flags: string[]; red_flag_prompt: string | null }) => void;
  onCancel?: () => void;
  calmingSuggestions?: string[];
}) {
  const create = useServerFn(createEpisode);
  const [step, setStep] = useState<Step>("symptom");
  const [symptom, setSymptom] = useState<string>("");
  const [timeOfDay, setTimeOfDay] = useState<string>("");
  const [antecedent, setAntecedent] = useState<string>("");
  const [intervention, setIntervention] = useState<string>("");
  const [outcome, setOutcome] = useState<string>("");
  const [distress, setDistress] = useState<number | null>(null);
  const [flags, setFlags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const order: Step[] = ["symptom", "when", "antecedent", "intervention", "outcome", "distress", "flags", "review"];
  const idx = order.indexOf(step);
  const next = () => setStep(order[Math.min(order.length - 1, idx + 1)]);
  const back = () => (idx === 0 ? onCancel?.() : setStep(order[idx - 1]));

  function toggleFlag(id: string) {
    setFlags((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await create({
        data: {
          description: [symptom && `Symptom: ${humanize(symptom)}`, timeOfDay && `Time: ${timeOfDay}`, antecedent && `Before: ${humanize(antecedent)}`, intervention && `Tried: ${intervention}`, outcome && `Result: ${humanize(outcome)}`].filter(Boolean).join(". "),
          symptom: (symptom || null) as any,
          time_of_day: (timeOfDay || null) as any,
          antecedent: (antecedent || null) as any,
          intervention_tried: intervention || null,
          outcome: (outcome || null) as any,
          caregiver_distress: distress,
          red_flags: flags,
        },
      });
      onSaved(res);
    } catch (e: any) {
      setError(e?.message ?? "Could not save episode");
    } finally {
      setSubmitting(false);
    }
  }

  function BigGrid<T extends string>({ options, value, onPick, label }: { options: readonly T[]; value: string; onPick: (v: T) => void; label: (v: T) => string }) {
    return (
      <div className="grid grid-cols-2 gap-3" role="radiogroup">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={value === o}
            onClick={() => { onPick(o); next(); }}
            className={`min-h-16 rounded-lg border-2 px-3 py-3 text-base font-medium capitalize ${value === o ? "border-primary bg-primary/10" : "border-border"}`}
          >
            {label(o)}
          </button>
        ))}
      </div>
    );
  }

  const stepNum = idx + 1;

  return (
    <div className="space-y-5">
      <div className="text-sm text-muted-foreground">Step {stepNum} of {order.length}</div>

      {step === "symptom" && (
        <section>
          <h3 className="text-xl font-semibold mb-3">What happened?</h3>
          <BigGrid options={SYMPTOM_OPTIONS} value={symptom} onPick={(v) => setSymptom(v)} label={humanize} />
        </section>
      )}

      {step === "when" && (
        <section>
          <h3 className="text-xl font-semibold mb-3">When?</h3>
          <BigGrid options={TIMES_OF_DAY} value={timeOfDay} onPick={(v) => setTimeOfDay(v)} label={(v) => v} />
        </section>
      )}

      {step === "antecedent" && (
        <section>
          <h3 className="text-xl font-semibold mb-3">What happened right before?</h3>
          <BigGrid options={ANTECEDENT_OPTIONS} value={antecedent} onPick={(v) => setAntecedent(v)} label={humanize} />
        </section>
      )}

      {step === "intervention" && (
        <section className="space-y-3">
          <h3 className="text-xl font-semibold">What did you try?</h3>
          {MUSIC_TRIGGER_SYMPTOMS.includes(symptom) && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <p className="text-sm font-medium">Try music — often helps at early signs.</p>
              <MusicTrigger />
            </div>
          )}
          {calmingSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {calmingSuggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setIntervention(s)}
                  className={`rounded-full border-2 px-3 py-2 text-sm min-h-10 ${intervention === s ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <input
            type="text"
            value={intervention}
            onChange={(e) => setIntervention(e.target.value)}
            placeholder="Type what you tried"
            className="w-full rounded border px-3 py-3 min-h-12 text-base"
          />
          <button type="button" onClick={next} className="w-full rounded-md bg-primary text-primary-foreground px-4 py-3 min-h-12 font-medium">Next</button>
        </section>
      )}

      {step === "outcome" && (
        <section>
          <h3 className="text-xl font-semibold mb-3">Did it help?</h3>
          <BigGrid options={OUTCOME_OPTIONS} value={outcome} onPick={(v) => setOutcome(v)} label={humanize} />
        </section>
      )}

      {step === "distress" && (
        <section>
          <h3 className="text-xl font-semibold mb-3">How hard was this on you? (optional)</h3>
          <div className="grid grid-cols-5 gap-2" role="radiogroup">
            {[0, 1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={distress === n}
                onClick={() => { setDistress(n); next(); }}
                className={`min-h-16 rounded-lg border-2 text-xl font-medium ${distress === n ? "border-primary bg-primary/10" : "border-border"}`}
              >
                {n}
              </button>
            ))}
          </div>
          <button type="button" onClick={next} className="mt-3 w-full rounded-md border-2 border-border px-4 py-3 min-h-12 text-sm">Skip</button>
        </section>
      )}

      {step === "flags" && (
        <section className="space-y-2">
          <h3 className="text-xl font-semibold mb-1">Any of these signs?</h3>
          {RED_FLAGS.map((f) => (
            <label key={f.id} className="flex items-start gap-2 cursor-pointer rounded-md border p-3">
              <input type="checkbox" checked={flags.includes(f.id)} onChange={() => toggleFlag(f.id)} className="h-5 w-5 mt-1" />
              <span>{f.label}</span>
            </label>
          ))}
          <button type="button" onClick={next} className="w-full rounded-md bg-primary text-primary-foreground px-4 py-3 min-h-12 font-medium">Next</button>
        </section>
      )}

      {step === "review" && (
        <section className="space-y-3">
          <h3 className="text-xl font-semibold">Confirm and save</h3>
          <ul className="rounded-md border p-3 text-sm space-y-1">
            <li><b>What:</b> {symptom ? humanize(symptom) : "—"}</li>
            <li><b>When:</b> {timeOfDay || "—"} (auto-timestamped {new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })})</li>
            <li><b>Before:</b> {antecedent ? humanize(antecedent) : "—"}</li>
            <li><b>Tried:</b> {intervention || "—"}</li>
            <li><b>Result:</b> {outcome ? humanize(outcome) : "—"}</li>
            <li><b>Distress:</b> {distress != null ? distress : "—"}</li>
            {flags.length > 0 && <li><b>Signs:</b> {flags.join(", ")}</li>}
          </ul>
          {error && <div className="text-sm text-destructive" role="alert">{error}</div>}
          <button type="button" disabled={submitting} onClick={submit} className="w-full rounded-md bg-primary text-primary-foreground px-4 py-3 min-h-12 font-medium disabled:opacity-50">
            {submitting ? "Saving…" : "Confirm & save"}
          </button>
        </section>
      )}

      <div className="flex gap-2 pt-2">
        <button type="button" onClick={back} className="rounded-md border-2 border-border px-4 py-3 min-h-12">← Back</button>
        {step !== "review" && step !== "intervention" && step !== "distress" && step !== "flags" && (
          <button type="button" onClick={next} className="rounded-md border-2 border-border px-4 py-3 min-h-12">Skip</button>
        )}
      </div>
    </div>
  );
}