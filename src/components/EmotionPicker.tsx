import { VOICE_MOODS, EMOTION_TEXT, AUTO_TEXT, type VoiceMood } from "@/lib/voice-emotion";

/** Choose how the voice speaks. Plain outlined chips; the selected one is filled. Shared by the demo and real voice cards. */
export function EmotionPicker({ value, onChange, lang, label, disabled }: { value: VoiceMood; onChange: (e: VoiceMood) => void; lang: "en" | "es"; label: string; disabled?: boolean }) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {VOICE_MOODS.map((e) => {
          const on = e === value;
          return (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(e)}
              className={"rounded-full border-2 px-4 min-h-11 text-sm font-semibold " + (on ? "border-primary bg-primary text-primary-foreground" : "border-foreground bg-card text-foreground")}
            >
              {e === "auto" ? AUTO_TEXT.label[lang] : EMOTION_TEXT[e].label[lang]}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{value === "auto" ? AUTO_TEXT.hint[lang] : EMOTION_TEXT[value].hint[lang]}</p>
    </fieldset>
  );
}
