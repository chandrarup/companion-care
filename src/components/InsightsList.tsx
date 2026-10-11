import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { dismissInsight, listInsights } from "@/lib/fingerprint.functions";

type Insight = {
  id: string;
  insight: {
    kind: string;
    antecedent: string;
    symptom: string;
    count: number;
    total: number;
    what_helped?: Array<{ intervention: string; outcome: string; count: number }>;
    window_days?: number;
  };
};

function humanize(s: string) {
  return s.replace(/_/g, " ");
}

export function InsightsList({ refreshKey = 0 }: { refreshKey?: number }) {
  const listFn = useServerFn(listInsights);
  const dismissFn = useServerFn(dismissInsight);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listFn();
      setInsights((res?.insights ?? []) as unknown as Insight[]);
    } finally {
      setLoading(false);
    }
  }, [listFn]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function onDismiss(id: string) {
    setInsights((cur) => cur.filter((i) => i.id !== id));
    try {
      await dismissFn({ data: { id } });
    } catch {
      load();
    }
  }

  if (loading && insights.length === 0) {
    return <p className="text-muted-foreground">Looking for patterns…</p>;
  }

  if (insights.length === 0) {
    return (
      <p className="text-muted-foreground">
        No patterns surfaced yet. We only show a pattern after we've seen it at least a few times.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {insights.map((row) => {
        const i = row.insight;
        // Phrasing is enforced server-template-free here: we ONLY state counts.
        const sentence = `We noticed ${humanize(i.antecedent)} before ${humanize(i.symptom)} ${i.count} of ${i.total} times.`;
        return (
          <li key={row.id} className="rounded-lg border-2 border-border p-4 bg-card">
            <p className="font-medium">{sentence}</p>
            {i.window_days && (
              <p className="text-xs text-muted-foreground mt-1">
                Over the last {i.window_days} days. Observations only — not a diagnosis.
              </p>
            )}
            {i.what_helped && i.what_helped.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium">What your family logged as helpful:</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {i.what_helped.map((w, idx) => (
                    <li key={idx} className="text-foreground">
                      • {w.intervention}{" "}
                      <span className="text-muted-foreground">({w.count}×)</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => onDismiss(row.id)}
                className="rounded-md border border-border px-3 py-2 text-sm min-h-10"
              >
                Dismiss
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}