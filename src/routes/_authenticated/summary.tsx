import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { useT } from "@/i18n/I18nProvider";
import { generatePhysicianSummary, listPhysicianSummaries } from "@/lib/summary.functions";
import {
  SymptomBarChart,
  TrendLine,
  AdherenceBadge,
  TopPatterns,
  TimeOfDayHeatmap,
  InterventionRanking,
  SleepCard,
  DistressTrend,
  SinceLastVisit,
} from "@/components/SummaryCharts";
import { listConcerns, addConcern, resolveConcern, deleteConcern } from "@/lib/concerns.functions";
import { getMyRole } from "@/lib/role.functions";

export const Route = createFileRoute("/_authenticated/summary")({
  head: () => ({ meta: [{ title: "Physician summary — Companion Care" }] }),
  component: SummaryPage,
});

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

type Summary = {
  id: string;
  summary: string;
  stats: any;
  period_start: string;
  period_end: string;
  created_at: string;
};

function SummaryPage() {
  const { t } = useT();
  const genFn = useServerFn(generatePhysicianSummary);
  const listFn = useServerFn(listPhysicianSummaries);
  const listConcernsFn = useServerFn(listConcerns);
  const addConcernFn = useServerFn(addConcern);
  const resolveConcernFn = useServerFn(resolveConcern);
  const deleteConcernFn = useServerFn(deleteConcern);
  const getRoleFn = useServerFn(getMyRole);

  const [start, setStart] = useState(isoDaysAgo(30));
  const [end, setEnd] = useState(isoDaysAgo(0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<Summary | null>(null);
  const [history, setHistory] = useState<Summary[]>([]);
  const [concerns, setConcerns] = useState<{ id: string; text: string; resolved_at: string | null }[]>([]);
  const [newConcern, setNewConcern] = useState("");
  const [role, setRole] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [r, c, ro]: any = await Promise.all([listFn(), listConcernsFn().catch(() => ({ concerns: [] })), getRoleFn()]);
    setHistory(r.summaries ?? []);
    setConcerns(c.concerns ?? []);
    setRole(ro?.role ?? null);
    if (!current && r.summaries?.[0]) {
      setCurrent(r.summaries[0]);
      if (r.summaries[0].period_end) setStart(r.summaries[0].period_end);
    }
  }, [listFn, listConcernsFn, getRoleFn, current]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res: any = await genFn({ data: { period_start: start, period_end: end } });
      setCurrent(res);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Could not generate summary");
    } finally {
      setBusy(false);
    }
  }

  async function submitConcern(e: FormEvent) {
    e.preventDefault();
    const text = newConcern.trim();
    if (!text) return;
    setNewConcern("");
    await addConcernFn({ data: { text } });
    const c: any = await listConcernsFn();
    setConcerns(c.concerns ?? []);
  }

  const isClinician = role === "clinician";

  return (
    <AppShell>
      <div data-surface="clinical" className="-mx-4 -my-6 px-4 py-6 min-h-screen">
      <div className="print:hidden">
        <h1 className="text-2xl font-semibold mb-2">{t("summary.title")}</h1>
        <p className="text-muted-foreground mb-4">
          {isClinician ? t("summary.clinicianSubtitle") : t("summary.subtitle")}
        </p>

        {!isClinician && (
          <div className="rounded-lg border border-border p-4 mb-6 flex flex-wrap gap-3 items-end bg-card">
            <button
              type="button"
              onClick={generate}
              disabled={busy}
              className="px-5 py-3 rounded-lg bg-primary text-primary-foreground disabled:opacity-50 min-h-12 font-medium text-base"
              data-touch
            >
              {busy ? t("summary.generating") : t("summary.oneTap")}
            </button>
            <label className="text-sm">
              <span className="block mb-1">{t("summary.from")}</span>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="rounded border border-input bg-background px-2 py-1" data-touch />
            </label>
            <label className="text-sm">
              <span className="block mb-1">{t("summary.to")}</span>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded border border-input bg-background px-2 py-1" data-touch />
            </label>
            {current && (
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded border border-border min-h-11"
                data-touch
              >
                {t("summary.print")}
              </button>
            )}
          </div>
        )}

        {isClinician && current && (
          <div className="mb-6">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 rounded border border-border min-h-11"
              data-touch
            >
              {t("summary.print")}
            </button>
          </div>
        )}

        {!isClinician && (
          <section className="rounded-lg border border-border p-4 mb-6 bg-card">
            <h2 className="font-medium mb-2">{t("summary.concernsTitle")}</h2>
            <p className="text-sm text-muted-foreground mb-3">{t("summary.concernsHint")}</p>
            <form onSubmit={submitConcern} className="flex gap-2 mb-3">
              <input
                value={newConcern}
                onChange={(e) => setNewConcern(e.target.value)}
                maxLength={500}
                placeholder={t("summary.concernsPlaceholder")}
                className="flex-1 rounded border border-input bg-background px-3 py-2 min-h-11"
                data-touch
              />
              <button type="submit" className="px-4 py-2 rounded bg-primary text-primary-foreground min-h-11" data-touch>
                {t("summary.add")}
              </button>
            </form>
            {concerns.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("summary.noConcerns")}</p>
            ) : (
              <ul className="space-y-2">
                {concerns.map((c) => (
                  <li key={c.id} className="flex items-start gap-2 text-sm">
                    <span className={`flex-1 ${c.resolved_at ? "line-through text-muted-foreground" : ""}`}>{c.text}</span>
                    {!c.resolved_at && (
                      <button
                        type="button"
                        onClick={async () => { await resolveConcernFn({ data: { id: c.id } }); const r: any = await listConcernsFn(); setConcerns(r.concerns ?? []); }}
                        className="text-xs underline"
                      >
                        {t("summary.markAsked")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () => { await deleteConcernFn({ data: { id: c.id } }); const r: any = await listConcernsFn(); setConcerns(r.concerns ?? []); }}
                      className="text-xs text-muted-foreground underline"
                    >
                      {t("common.delete")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {error && <div className="mb-4 rounded border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</div>}
      </div>

      {current && <PhysicianSummaryView s={current} />}

      {history.length > 1 && (
        <section className="mt-8 print:hidden">
          <h2 className="text-lg font-semibold mb-2">{t("summary.history")}</h2>
          <ul className="space-y-1">
            {history.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => setCurrent(h)}
                  className="text-sm underline"
                >
                  {h.period_start} → {h.period_end} ({new Date(h.created_at).toLocaleDateString()})
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      </div>
    </AppShell>
  );
}

export function PhysicianSummaryView({ s }: { s: Summary }) {
  const { t } = useT();
  const stats = s.stats ?? {};
  return (
    <article className="space-y-4 print:space-y-3">
      <header className="mb-2">
        <h2 className="text-xl font-semibold">{t("summary.cardTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {s.period_start} → {s.period_end} · {stats.log_count ?? 0} {t("summary.logs")} · {stats.episode_count ?? 0} {t("summary.episodes")}
        </p>
      </header>

      <Card title={t("summary.sinceLast")} accent>
        <SinceLastVisit
          newSymptoms={stats.new_symptoms ?? []}
          escalations={stats.escalations ?? []}
          redFlags={stats.red_flag_events ?? []}
          nearCrises={stats.near_crises ?? 0}
        />
      </Card>

      <Card title={t("summary.behaviorTrends")}>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">{t("summary.symptomFreq")}</div>
            <SymptomBarChart counts={stats.symptom_counts ?? {}} />
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">{t("summary.trend")}</div>
            <TrendLine current={stats.symptom_counts ?? {}} prior={stats.prior_symptom_counts ?? {}} />
          </div>
          <div className="md:col-span-2">
            <div className="text-xs font-medium text-muted-foreground mb-1">{t("summary.timeOfDay")}</div>
            <TimeOfDayHeatmap tod={stats.time_of_day ?? {}} />
          </div>
          <div className="md:col-span-2">
            <div className="text-xs font-medium text-muted-foreground mb-1">{t("summary.topPatterns")}</div>
            <TopPatterns patterns={stats.top_patterns ?? []} />
          </div>
        </div>
      </Card>

      <Card title={t("summary.whatsWorking")}>
        <InterventionRanking items={stats.intervention_ranking ?? []} />
      </Card>

      <Card title={t("summary.sleepRoutine")}>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">{t("summary.sleep")}</div>
            <SleepCard sleep={stats.sleep ?? { current_avg: null, prior_avg: null, nights_under_6: 0, total_nights: 0 }} />
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">{t("summary.adherence")}</div>
            <AdherenceBadge pct={stats.cue_adherence_pct ?? null} done={stats.cue_events_done ?? 0} total={stats.cue_events_total ?? 0} />
          </div>
        </div>
      </Card>

      <Card title={t("summary.caregiverWellbeing")}>
        <DistressTrend
          series={stats.distress?.series ?? []}
          rising={!!stats.distress?.rising}
          current={stats.distress?.current_avg ?? null}
          prior={stats.distress?.prior_avg ?? null}
        />
      </Card>

      <Card title={t("summary.concernsCard")}>
        {(stats.concerns ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("summary.noConcerns")}</p>
        ) : (
          <ol className="list-decimal list-inside space-y-1 text-sm">
            {(stats.concerns as string[]).map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ol>
        )}
      </Card>

      <section className="mt-6 rounded-xl border border-border bg-card p-4 print:p-3 print:break-inside-avoid">
        <h3 className="font-semibold mb-2">{t("summary.narrative")}</h3>
        <p className="leading-relaxed whitespace-pre-wrap">{s.summary}</p>
        <p className="text-xs text-muted-foreground mt-2">{t("summary.disclaimer")}</p>
      </section>

      <footer className="mt-4 pt-4 border-t border-border text-sm text-muted-foreground space-y-1 print:break-inside-avoid">
        <div>
          <span className="font-medium text-foreground">{t("summary.meds")}:</span>{" "}
          {(stats.medications ?? []).length > 0 ? (stats.medications as string[]).join(", ") : "—"}
        </div>
        <div>
          <span className="font-medium text-foreground">{t("summary.activeCues")}:</span>{" "}
          {(stats.active_cues ?? []).length > 0 ? (stats.active_cues as string[]).join(", ") : "—"}
        </div>
        <p className="text-xs italic">{t("summary.medsDisclaimer")}</p>
      </footer>
    </article>
  );
}

function Card({ title, children, accent = false }: { title: string; children: ReactNode; accent?: boolean }) {
  return (
    <section
      className={`rounded-xl border bg-card p-4 print:border print:rounded-none print:p-3 print:break-inside-avoid ${
        accent ? "border-primary/40 ring-1 ring-primary/20" : "border-border"
      }`}
    >
      <h3 className="font-semibold mb-3 text-base">{title}</h3>
      {children}
    </section>
  );
}