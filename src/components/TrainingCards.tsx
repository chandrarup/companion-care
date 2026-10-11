import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listSurfacedTraining, recordTrainingFeedback } from "@/lib/training.functions";
import { useT } from "@/i18n/I18nProvider";

type Card = {
  id: string;
  title: string;
  body: string | null;
  video_url: string | null;
  source_attribution: string | null;
  action_card_text: string | null;
  symptom_tag: string | null;
  observed_count: number;
};

export function TrainingCards({ refreshKey = 0 }: { refreshKey?: number }) {
  const fn = useServerFn(listSurfacedTraining);
  const feedbackFn = useServerFn(recordTrainingFeedback);
  const { t } = useT();
  const [cards, setCards] = useState<Card[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await fn();
        setCards(((res?.cards ?? []) as unknown) as Card[]);
      } finally {
        setLoaded(true);
      }
    })();
  }, [fn, refreshKey]);

  if (!loaded || cards.length === 0) return null;

  async function save(id: string, payload: { helped?: "helped" | "no_change" | "worse"; action_saved?: boolean }) {
    try {
      await feedbackFn({ data: { training_id: id, ...payload } });
      setDone((d) => ({ ...d, [id]: payload.helped ? `feedback:${payload.helped}` : "saved" }));
    } catch {}
  }

  return (
    <section aria-labelledby="training" className="mt-6">
      <h2 id="training" className="text-lg font-semibold mb-2">
        {t("learn.queuedHeading")}
      </h2>
      <ul className="space-y-3">
        {cards.map((c) => (
          <li key={c.id} className="rounded-lg border-2 border-border p-4 bg-card">
            <div className="text-xs uppercase text-muted-foreground">
              {c.symptom_tag?.replace(/_/g, " ")} · {t("learn.seenThisWeek", { n: c.observed_count })}
            </div>
            <h3 className="font-semibold mt-1">{c.title}</h3>
            {c.video_url && (
              <div className="mt-2 aspect-video">
                <iframe
                  src={c.video_url}
                  title={c.title}
                  className="w-full h-full rounded"
                  allow="accelerometer; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
            {c.action_card_text && (
              <div className="mt-3 rounded-md bg-primary/10 border border-primary/30 p-3 space-y-2">
                <p className="font-medium">{c.action_card_text}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => save(c.id, { action_saved: true })}
                    disabled={!!done[c.id]}
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-10 disabled:opacity-60"
                  >
                    {done[c.id] === "saved" ? t("learn.saved") : t("learn.saveAction")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedbackOpen((f) => ({ ...f, [c.id]: true }))}
                    disabled={!!done[c.id]?.startsWith("feedback")}
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-10 disabled:opacity-60"
                  >
                    {t("learn.iTriedThis")}
                  </button>
                </div>
                {feedbackOpen[c.id] && !done[c.id]?.startsWith("feedback") && (
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <button type="button" onClick={() => save(c.id, { helped: "helped" })} className="min-h-12 rounded-md border-2 border-border px-2 py-2 text-sm">{t("music.helped")}</button>
                    <button type="button" onClick={() => save(c.id, { helped: "no_change" })} className="min-h-12 rounded-md border-2 border-border px-2 py-2 text-sm">{t("music.noChange")}</button>
                    <button type="button" onClick={() => save(c.id, { helped: "worse" })} className="min-h-12 rounded-md border-2 border-border px-2 py-2 text-sm">{t("music.worse")}</button>
                  </div>
                )}
                {done[c.id]?.startsWith("feedback") && (
                  <p className="text-xs text-muted-foreground">{t("learn.thanks")}</p>
                )}
              </div>
            )}
            {c.body && <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>}
            {c.source_attribution && (
              <p className="mt-2 text-xs text-muted-foreground">{t("learn.source")}: {c.source_attribution}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}