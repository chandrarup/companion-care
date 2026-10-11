import { RED_FLAG_PROMPT, RED_FLAGS } from "@/lib/episodes.functions";

/**
 * Non-dismissable card. Renders the verbatim prompt exactly as required by the
 * product brief — the app never interprets beyond this text.
 */
export function RedFlagCard({ flags }: { flags: string[] }) {
  if (flags.length === 0) return null;
  const labels = RED_FLAGS.filter((f) => flags.includes(f.id)).map((f) => f.label);
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-lg border-4 border-destructive bg-destructive/10 p-4 my-4"
    >
      <p className="text-lg font-semibold text-destructive">{RED_FLAG_PROMPT}</p>
      {labels.length > 0 && (
        <ul className="mt-2 list-disc list-inside text-sm">
          {labels.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
      <p className="text-xs mt-2 text-muted-foreground">
        This message stays until you contact your doctor's office.
      </p>
    </div>
  );
}