import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Lock } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { listRecentLogs } from "@/lib/daily-log.functions";
import { isLockedClient } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/logs")({
  head: () => ({ meta: [{ title: "Past logs — Companion Care" }] }),
  component: LogsPage,
});

type RecentLog = {
  id: string;
  log_date: string;
  mood: number | null;
  sleep_quality: number | null;
  notes: string | null;
  created_at: string;
  log_symptoms: { symptom: string; time_of_day: string | null; antecedent: string | null; outcome: string | null }[];
};

function LogsPage() {
  const listFn = useServerFn(listRecentLogs);
  const [logs, setLogs] = useState<RecentLog[]>([]);
  const [editLockDays, setEditLockDays] = useState(3);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await listFn();
        setLogs((res?.logs ?? []) as RecentLog[]);
        setEditLockDays((res as any)?.editLockDays ?? 3);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [listFn]);

  const byDate = logs.reduce<Record<string, RecentLog[]>>((acc, l) => {
    const k = l.log_date ?? l.created_at.slice(0, 10);
    (acc[k] ||= []).push(l);
    return acc;
  }, {});
  const dates = Object.keys(byDate).sort().reverse();

  return (
    <AppShell>
      <div className="space-y-4">
        <Link to="/today" className="inline-flex items-center text-sm text-muted-foreground hover:underline"><ChevronLeft size={16} />Back to Today</Link>
        {loading && <p className="text-muted-foreground">Loading…</p>}
        {!loading && dates.length === 0 && <p className="text-muted-foreground">No logs yet.</p>}
        {dates.map((d) => (
          <section key={d}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {new Date(d).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </h2>
            <ul className="space-y-2">
              {byDate[d].map((l) => (
                <li key={l.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{new Date(l.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                    <span className="flex items-center gap-2">
                      {l.mood && <span>Mood {l.mood}/5</span>}
                      {isLockedClient(l.created_at, editLockDays) && (
                        <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5"><Lock size={12} /> locked</span>
                      )}
                    </span>
                  </div>
                  {l.notes && <p className="mt-1 text-sm">{l.notes}</p>}
                  {l.log_symptoms?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {l.log_symptoms.map((s, i) => (
                        <span key={i} className="rounded-full bg-muted px-2 py-1 text-xs capitalize">
                          {s.symptom.replace(/_/g, " ")}{s.outcome ? ` · ${s.outcome.replace(/_/g, " ")}` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
