const ACCENT = "#AE4A2A";
const ACCENT_SOFT = "rgba(174,74,42,0.10)";
const NEUTRAL_SERIES = "#6F645B";
const MUTED_INK = "#5E554E";
const GRID_INK = "#E6DED5";

type Counts = Record<string, number>;

export function SymptomBarChart({ counts }: { counts: Counts }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No symptoms logged in this period.</p>;
  const max = Math.max(...entries.map(([, v]) => v));
  return (
    <div role="img" aria-label="Symptom frequency bar chart" className="space-y-2">
      {entries.map(([label, v]) => (
        <div key={label} className="grid grid-cols-[10rem_1fr_2.5rem] items-center gap-2 text-sm">
          <span className="capitalize text-foreground">{label.replace(/_/g, " ")}</span>
          <div className="h-2.5 rounded-full" style={{ background: ACCENT_SOFT }}>
            <div
              className="h-2.5 rounded-full"
              style={{ width: `${Math.max(4, (v / max) * 100)}%`, background: ACCENT }}
              aria-hidden
            />
          </div>
          <span className="text-foreground tabular-nums text-right">{v}</span>
        </div>
      ))}
    </div>
  );
}

export function TrendLine({ current, prior }: { current: Counts; prior: Counts }) {
  const keys = Array.from(new Set([...Object.keys(current), ...Object.keys(prior)]));
  const series = keys.map((k) => ({ label: k, now: current[k] ?? 0, before: prior[k] ?? 0 }));
  series.sort((a, b) => b.now + b.before - (a.now + a.before));
  if (series.length === 0) return <p className="text-sm text-muted-foreground">Not enough data to compare.</p>;
  const max = Math.max(1, ...series.flatMap((s) => [s.now, s.before]));
  const padL = 8;
  const padR = 8;
  const padT = 8;
  const padB = 28;
  const w = 320;
  const h = 140;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const step = series.length > 1 ? innerW / (series.length - 1) : innerW;
  const path = (vals: number[]) =>
    vals
      .map((v, i) => {
        const x = padL + i * step;
        const y = padT + innerH - (v / max) * innerH;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" role="img" aria-label="Trend vs prior period">
        <line x1={padL} x2={w - padR} y1={padT + innerH} y2={padT + innerH} stroke={GRID_INK} strokeWidth={0.5} />
        <path d={path(series.map((s) => s.before))} fill="none" stroke={MUTED_INK} strokeWidth={1.5} strokeDasharray="4 3" strokeLinecap="round" />
        <path d={path(series.map((s) => s.now))} fill="none" stroke={ACCENT} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
        {series.map((s, i) => {
          const x = padL + i * step;
          const y = padT + innerH - (s.now / max) * innerH;
          return <circle key={`d-${s.label}`} cx={x} cy={y} r={2.5} fill={ACCENT} />;
        })}
        {series.map((s, i) => (
          <text key={s.label} x={padL + i * step} y={h - 8} fontSize={9} textAnchor="middle" fill={MUTED_INK}>
            {s.label.replace(/_/g, " ").slice(0, 8)}
          </text>
        ))}
      </svg>
      <p className="text-xs text-muted-foreground mt-1">Solid = this period. Dashed = prior period.</p>
    </div>
  );
}

export function AdherenceBadge({ pct, done, total }: { pct: number | null; done: number; total: number }) {
  if (pct == null) return <p className="text-sm text-muted-foreground">No scheduled cues this period.</p>;
  return (
    <div className="flex items-center gap-3">
      <div className="text-3xl font-semibold tabular-nums">{pct}%</div>
      <div className="text-sm text-muted-foreground">
        Cues completed ({done}/{total})
      </div>
    </div>
  );
}

export function TopPatterns({ patterns }: { patterns: Array<{ antecedent: string; symptom: string; count: number; total: number }> }) {
  if (patterns.length === 0) return <p className="text-sm text-muted-foreground">No recurring patterns this period.</p>;
  return (
    <ul className="space-y-1 text-sm">
      {patterns.map((p, i) => (
        <li key={i}>
          We noticed <strong>{p.antecedent.replace(/_/g, " ")}</strong> before{" "}
          <strong>{p.symptom.replace(/_/g, " ")}</strong>{" "}
          {p.count} of {p.total} times.
        </li>
      ))}
    </ul>
  );
}

const BUCKETS = ["morning", "afternoon", "evening", "night"] as const;

export function TimeOfDayHeatmap({ tod }: { tod: Record<string, Record<string, number>> }) {
  const rows = Object.entries(tod);
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No timing data.</p>;
  const max = Math.max(1, ...rows.flatMap(([, b]) => BUCKETS.map((k) => b[k] ?? 0)));
  return (
    <div className="overflow-x-auto" role="img" aria-label="Time-of-day heatmap">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left pr-3 font-normal text-muted-foreground"></th>
            {BUCKETS.map((b) => (
              <th key={b} className="px-2 py-1 font-normal text-muted-foreground capitalize">{b}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([sym, b]) => (
            <tr key={sym}>
              <td className="pr-3 py-1 capitalize">{sym.replace(/_/g, " ")}</td>
              {BUCKETS.map((k) => {
                const v = b[k] ?? 0;
                const alpha = v === 0 ? 0.04 : 0.15 + (v / max) * 0.75;
                const fg = v === 0 ? MUTED_INK : alpha > 0.55 ? "#FFFFFF" : ACCENT;
                return (
                  <td key={k} className="px-1 py-1">
                    <div
                      className="h-9 w-14 rounded-lg grid place-items-center tabular-nums text-xs font-medium"
                      style={{ backgroundColor: `rgba(174,74,42,${alpha})`, color: fg }}
                    >
                      {v > 0 ? v : ""}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InterventionRanking({
  items,
}: {
  items: Array<{ intervention: string; tried: number; helped: number }>;
}) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No interventions logged.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {items.map((i) => {
        const pct = i.tried > 0 ? Math.round((i.helped / i.tried) * 100) : 0;
        return (
          <li key={i.intervention} className="grid grid-cols-[1fr_auto] gap-2 items-center">
            <div>
              <div className="font-medium">{i.intervention}</div>
              <div className="h-2 rounded-full mt-1" style={{ background: "rgba(111,100,91,0.12)" }}>
                <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: NEUTRAL_SERIES }} aria-hidden />
              </div>
            </div>
            <div className="tabular-nums text-muted-foreground text-right">
              {i.helped}/{i.tried}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function SleepCard({
  sleep,
}: {
  sleep: { current_avg: number | null; prior_avg: number | null; nights_under_6: number; total_nights: number };
}) {
  const delta =
    sleep.current_avg != null && sleep.prior_avg != null
      ? Math.round((sleep.current_avg - sleep.prior_avg) * 10) / 10
      : null;
  const arrow = delta == null ? "" : delta > 0 ? "▲" : delta < 0 ? "▼" : "•";
  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-semibold tabular-nums">
          {sleep.current_avg != null ? `${sleep.current_avg}h` : "—"}
        </span>
        {delta != null && (
          <span className="text-sm text-muted-foreground tabular-nums">
            {arrow} {Math.abs(delta)}h vs prior
          </span>
        )}
      </div>
      <div className="text-sm text-muted-foreground">
        {sleep.nights_under_6} of {sleep.total_nights || 0} nights under 6h
      </div>
    </div>
  );
}

export function DistressTrend({
  series,
  rising,
  current,
  prior,
}: {
  series: { date: string; value: number }[];
  rising: boolean;
  current: number | null;
  prior: number | null;
}) {
  if (series.length === 0) return <p className="text-sm text-muted-foreground">No caregiver-strain entries yet.</p>;
  const w = 320;
  const h = 60;
  const max = 4;
  const step = series.length > 1 ? w / (series.length - 1) : w;
  const path = series
    .map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - (p.value / max) * h}`)
    .join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h + 12}`} className="w-full h-auto" role="img" aria-label="Caregiver strain trend">
        <path d={path} fill="none" stroke={ACCENT} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="text-sm text-muted-foreground">
        Avg {current ?? "—"} (prior {prior ?? "—"}) on 0–4 scale
      </div>
      {rising && (
        <p className="mt-2 text-sm rounded bg-muted text-foreground p-2">
          Caregiver strain has been trending higher this period. Consider a check-in.
        </p>
      )}
    </div>
  );
}

export function SinceLastVisit({
  newSymptoms,
  escalations,
  redFlags,
  nearCrises,
}: {
  newSymptoms: { symptom: string; first_seen: string | null; count: number }[];
  escalations: { symptom: string; now: number; before: number }[];
  redFlags: { occurred_at: string; flags: string[] }[];
  nearCrises: number;
}) {
  const empty = newSymptoms.length === 0 && escalations.length === 0 && redFlags.length === 0 && nearCrises === 0;
  if (empty) return <p className="text-sm text-muted-foreground">No new symptoms, escalations, or red-flag events this period.</p>;
  return (
    <div className="space-y-3 text-sm">
      {newSymptoms.length > 0 && (
        <div>
          <div className="font-medium mb-1">New symptoms</div>
          <ul className="space-y-0.5">
            {newSymptoms.map((s) => (
              <li key={s.symptom} className="capitalize">
                {s.symptom.replace(/_/g, " ")} — first seen{" "}
                {s.first_seen ? new Date(s.first_seen).toLocaleDateString() : "—"} · {s.count}×
              </li>
            ))}
          </ul>
        </div>
      )}
      {escalations.length > 0 && (
        <div>
          <div className="font-medium mb-1">Escalations</div>
          <ul className="space-y-0.5">
            {escalations.map((e) => (
              <li key={e.symptom} className="capitalize">
                {e.symptom.replace(/_/g, " ")}: {e.before} → {e.now}
              </li>
            ))}
          </ul>
        </div>
      )}
      {redFlags.length > 0 && (
        <div className="rounded border border-destructive/50 bg-destructive/10 p-2">
          <div className="font-medium text-destructive">Red-flag events: {redFlags.length}</div>
          <ul className="text-xs mt-1 space-y-0.5">
            {redFlags.slice(0, 5).map((r, i) => (
              <li key={i}>
                {new Date(r.occurred_at).toLocaleDateString()} — {r.flags.join(", ").replace(/_/g, " ")}
              </li>
            ))}
          </ul>
        </div>
      )}
      {nearCrises > 0 && (
        <div className="text-sm">
          <span className="font-medium">Near-crisis events logged:</span> {nearCrises}
        </div>
      )}
    </div>
  );
}