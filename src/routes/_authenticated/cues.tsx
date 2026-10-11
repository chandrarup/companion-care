import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { CUE_TYPES, deleteCue, listCues, upsertCue } from "@/lib/cues.functions";

export const Route = createFileRoute("/_authenticated/cues")({
  head: () => ({ meta: [{ title: "Cues — Companion Care" }] }),
  component: CuesPage,
});

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type CueRow = {
  id: string;
  cue_type: string;
  label: string;
  schedule_times: string[];
  days_of_week: number[];
  active: boolean;
};

function CuesPage() {
  const list = useServerFn(listCues);
  const save = useServerFn(upsertCue);
  const del = useServerFn(deleteCue);
  const [items, setItems] = useState<CueRow[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    cue_type: "hydration" as (typeof CUE_TYPES)[number],
    label: "",
    times: "09:00",
    days: [0, 1, 2, 3, 4, 5, 6],
    active: true,
  });
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await list();
    setItems(((res?.cues ?? []) as unknown) as CueRow[]);
  }, [list]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function toggleDay(d: number) {
    setForm((f) =>
      f.days.includes(d) ? { ...f, days: f.days.filter((x) => x !== d) } : { ...f, days: [...f.days, d].sort() },
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const schedule_times = form.times
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await save({
        data: {
          cue_type: form.cue_type,
          label: form.label,
          schedule_times,
          days_of_week: form.days,
          active: form.active,
        },
      });
      setEditing(false);
      setForm({ cue_type: "hydration", label: "", times: "09:00", days: [0, 1, 2, 3, 4, 5, 6], active: true });
      refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Could not save cue");
    }
  }

  async function remove(id: string) {
    await del({ data: { id } });
    refresh();
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold mb-4">Cues & reminders</h1>

      {!editing && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mb-4 rounded-md bg-primary text-primary-foreground px-4 py-3 font-medium min-h-12"
        >
          ＋ New reminder
        </button>
      )}

      {editing && (
        <form onSubmit={submit} className="space-y-3 rounded-lg border-2 border-border p-4 mb-4">
          <label className="block">
            <span className="font-medium">Type</span>
            <select
              value={form.cue_type}
              onChange={(e) => setForm({ ...form, cue_type: e.target.value as any })}
              className="mt-1 w-full rounded border px-2 py-2 min-h-10 bg-background capitalize"
            >
              {CUE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="font-medium">Label</span>
            <input
              required
              type="text"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="mt-1 w-full rounded border px-2 py-2 min-h-10"
              placeholder="e.g. Drink water"
            />
          </label>
          <label className="block">
            <span className="font-medium">Times (HH:MM, comma-separated)</span>
            <input
              required
              type="text"
              value={form.times}
              onChange={(e) => setForm({ ...form, times: e.target.value })}
              className="mt-1 w-full rounded border px-2 py-2 min-h-10"
              placeholder="09:00, 13:00, 17:00"
            />
          </label>
          <div>
            <span className="font-medium">Days</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {DAY_LABELS.map((d, i) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => toggleDay(i)}
                  className={`rounded border-2 px-3 py-2 text-sm min-h-10 ${
                    form.days.includes(i)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded-md bg-primary text-primary-foreground px-4 py-3 font-medium min-h-12"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md border-2 border-border px-4 py-3 font-medium min-h-12"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <p className="text-muted-foreground">No reminders yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((c) => (
            <li key={c.id} className="rounded-md border p-3">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="font-medium">
                    <span className="capitalize">{c.cue_type}</span> — {c.label}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {c.schedule_times.join(", ")} · {c.days_of_week.map((d) => DAY_LABELS[d]).join(" ")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  className="rounded border px-3 py-2 text-sm min-h-10"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}