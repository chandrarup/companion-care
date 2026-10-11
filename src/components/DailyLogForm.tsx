import { useState } from "react";

export type SymptomEntry = {
  symptom: string;
  time_of_day: string | null;
  antecedent: string | null;
  intervention_tried: string | null;
  outcome: string | null;
};

export type DailyLogFormValue = {
  mood: number | null;
  sleep_quality: number | null;
  sleep_hours: number | null;
  caregiver_distress: number | null;
  notes: string;
  symptoms: SymptomEntry[];
  quick_ok?: boolean;
  any_symptoms?: boolean;
};

const MOOD_FACES = ["😖", "😕", "😐", "🙂", "😊"];

function Scale({
  value,
  onChange,
  labels,
  ariaLabel,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  labels: string[];
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex gap-2">
      {labels.map((l, i) => {
        const v = i + 1;
        const selected = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(selected ? null : v)}
            className={`flex-1 min-h-12 rounded-md border-2 text-2xl font-medium px-2 py-2 ${
              selected ? "border-primary bg-primary/10" : "border-border bg-background"
            }`}
          >
            <span aria-hidden>{l}</span>
            <span className="sr-only">{v}</span>
          </button>
        );
      })}
    </div>
  );
}

export function DailyLogForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
  submitLabel = "Save log",
  onAnySymptomsYes,
}: {
  initial?: Partial<DailyLogFormValue>;
  submitting?: boolean;
  onSubmit: (v: DailyLogFormValue) => void;
  onCancel?: () => void;
  submitLabel?: string;
  onAnySymptomsYes?: (snapshot: DailyLogFormValue) => void;
}) {
  const [mood, setMood] = useState<number | null>(initial?.mood ?? null);
  const [sleep, setSleep] = useState<number | null>(initial?.sleep_quality ?? null);
  const [hours, setHours] = useState<string>(initial?.sleep_hours != null ? String(initial.sleep_hours) : "");
  const [distress, setDistress] = useState<number | null>(initial?.caregiver_distress ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [symptoms] = useState<SymptomEntry[]>(initial?.symptoms ?? []);

  function snapshot(): DailyLogFormValue {
    return {
      mood,
      sleep_quality: sleep,
      sleep_hours: hours ? Number(hours) : null,
      caregiver_distress: distress,
      notes,
      symptoms,
    };
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(snapshot());
      }}
    >
      <fieldset>
        <legend className="font-medium mb-2">Mood today</legend>
        <Scale value={mood} onChange={setMood} labels={MOOD_FACES} ariaLabel="Mood 1 to 5" />
      </fieldset>

      <fieldset>
        <legend className="font-medium mb-2">Sleep quality (optional)</legend>
        <Scale
          value={sleep}
          onChange={setSleep}
          labels={["1", "2", "3", "4", "5"]}
          ariaLabel="Sleep quality 1 to 5"
        />
        <label className="block mt-2 text-sm">
          Hours of sleep (optional)
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={24}
            step="0.5"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="mt-1 w-32 rounded border px-2 py-2 min-h-10"
          />
        </label>
      </fieldset>

      <fieldset>
        <legend className="font-medium mb-2">How hard was today on you? (optional)</legend>
        <Scale
          value={distress != null ? distress + 1 : null}
          onChange={(v) => setDistress(v == null ? null : v - 1)}
          labels={["0", "1", "2", "3", "4"]}
          ariaLabel="Caregiver distress 0 to 4"
        />
      </fieldset>

      <label className="block">
        <span className="font-medium">Notes (optional)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded border px-2 py-2"
        />
      </label>

      {onAnySymptomsYes && (
        <fieldset>
          <legend className="font-medium mb-2">Any symptoms today?</legend>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onAnySymptomsYes(snapshot())}
              className="rounded-md border-2 border-destructive/50 text-destructive px-4 py-3 font-medium min-h-12"
            >
              Yes — log episode
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-primary text-primary-foreground px-4 py-3 font-medium min-h-12 disabled:opacity-50"
            >
              {submitting ? "Saving…" : "No — save"}
            </button>
          </div>
        </fieldset>
      )}

      <div className="flex gap-2">
        {!onAnySymptomsYes && (
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-md bg-primary text-primary-foreground px-4 py-3 font-medium min-h-12 disabled:opacity-50"
          >
            {submitting ? "Saving…" : submitLabel}
          </button>
        )}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border-2 border-border px-4 py-3 font-medium min-h-12"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}