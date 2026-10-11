import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { logCueEvent, todaysPendingCues } from "@/lib/cues.functions";

type Pending = { cue_id: string; label: string; cue_type: string; time: string };

export function CuesPanel() {
  const list = useServerFn(todaysPendingCues);
  const logFn = useServerFn(logCueEvent);
  const [pending, setPending] = useState<Pending[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await list();
      setPending(((res?.pending ?? []) as unknown) as Pending[]);
    } finally {
      setLoaded(true);
    }
  }, [list]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5 * 60 * 1000); // re-poll every 5 min while open
    return () => clearInterval(t);
  }, [refresh]);

  async function ack(p: Pending, outcome: "done" | "missed" | "snoozed") {
    setPending((cur) => cur.filter((x) => !(x.cue_id === p.cue_id && x.time === p.time)));
    const today = new Date();
    const [h, m] = p.time.split(":");
    today.setHours(Number(h), Number(m), 0, 0);
    try {
      await logFn({
        data: { cue_id: p.cue_id, outcome, scheduled_for: today.toISOString() },
      });
    } catch {
      refresh();
    }
  }

  if (!loaded) return null;
  if (pending.length === 0) return null;

  return (
    <section className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 my-4">
      <h2 className="font-semibold mb-2">Reminders due</h2>
      <ul className="space-y-2">
        {pending.map((p) => (
          <li
            key={`${p.cue_id}-${p.time}`}
            className="flex flex-wrap items-center gap-2 rounded border bg-background p-2"
          >
            <span className="font-medium">{p.time}</span>
            <span className="capitalize text-sm text-muted-foreground">{p.cue_type}</span>
            <span className="flex-1">{p.label}</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => ack(p, "done")}
                className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm min-h-10"
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => ack(p, "snoozed")}
                className="rounded-md border px-3 py-2 text-sm min-h-10"
              >
                Snooze
              </button>
              <button
                type="button"
                onClick={() => ack(p, "missed")}
                className="rounded-md border px-3 py-2 text-sm min-h-10"
              >
                Missed
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}