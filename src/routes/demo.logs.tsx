import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { DEMO_LOGS } from "@/lib/demo/data";
import { useDemoEntries } from "@/lib/demo/log-store";
import { useMounted } from "@/lib/use-mounted";

export const Route = createFileRoute("/demo/logs")({
  component: DemoLogs,
});

function DemoLogs() {
  const { t, lang } = useT();
  const L = (lang as "en" | "es") === "es" ? "es" : "en";
  const live = useDemoEntries();
  const mounted = useMounted(); // dates depend on the viewer's time zone, so they render after hydration

  // Group by date
  const byDate = DEMO_LOGS.reduce<Record<string, typeof DEMO_LOGS>>((acc, l) => {
    (acc[l.date] ||= []).push(l);
    return acc;
  }, {});
  const dates = Object.keys(byDate).sort().reverse();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-4">
      <Link to="/demo/caregiver" className="inline-flex items-center text-sm text-muted-foreground hover:underline"><ChevronLeft size={16} />{L === "es" ? "Atrás" : "Back"}</Link>
      <h1 className="text-2xl font-semibold">{t("demo.caregiver.pastLogs")}</h1>
      <p className="text-sm text-muted-foreground">{t("demo.caregiver.pastLogsHint")}</p>

      {mounted && live.length > 0 && (
        <section className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-primary mb-2">
            {L === "es" ? "Añadido en este demo" : "Added in this demo"}
          </h2>
          <ul className="space-y-2">
            {live.map((e) => (
              <li key={e.id} className="text-sm">
                <span className="font-medium">
                  {new Date(e.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>{" "}
                · {e.source === "patient" ? "Rosa" : (L === "es" ? "Cuidadora" : "Caregiver")}
                {" — "}
                {e.kind === "episode"
                  ? <span className="capitalize">{e.symptom?.replace(/_/g, " ") || "—"}{e.outcome ? ` · ${e.outcome.replace(/_/g, " ")}` : ""}</span>
                  : <span>{e.mood ? `${L === "es" ? "Ánimo" : "Mood"} ${e.mood}/5` : ""}{e.sleep ? ` · ${L === "es" ? "sueño" : "sleep"} ${e.sleep}` : ""}{e.note ? ` — "${e.note}"` : ""}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="space-y-6 mt-4">
        {mounted && dates.map((d) => (
          <section key={d}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {new Date(d + "T00:00:00").toLocaleDateString(L === "es" ? "es" : "en", { weekday: "long", month: "long", day: "numeric" })}
            </h2>
            <ul className="space-y-2">
              {byDate[d].map((l) => (
                <li key={l.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{L === "es" ? "Ánimo" : "Mood"} {l.mood}/5 · {L === "es" ? "Sueño" : "Sleep"}: {l.sleep}</span>
                  </div>
                  <p className="mt-1 text-sm">{l.notes[L]}</p>
                  {l.symptoms.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {l.symptoms.map((s, i) => (
                        <span key={i} className="rounded-full bg-muted px-2 py-1 text-xs">
                          {s.name[L]}{s.outcome ? ` · ${s.outcome[L]}` : ""}
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
    </div>
  );
}
