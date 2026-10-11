import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { TrainingCards } from "@/components/TrainingCards";
import { useT } from "@/i18n/I18nProvider";
import { listAllTraining, recordTrainingFeedback } from "@/lib/training.functions";

export const Route = createFileRoute("/_authenticated/learn")({
  head: () => ({ meta: [{ title: "Learn — Companion Care" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    tag: typeof s.tag === "string" ? s.tag : undefined,
  }),
  component: LearnPage,
});

type Item = {
  id: string;
  title: string;
  body: string | null;
  video_url: string | null;
  source_attribution: string | null;
  action_card_text: string | null;
  symptom_tag: string | null;
  language: string;
};

function LearnPage() {
  const { t, lang } = useT();
  const listFn = useServerFn(listAllTraining);
  const feedbackFn = useServerFn(recordTrainingFeedback);
  const [items, setItems] = useState<Item[]>([]);
  const search = Route.useSearch();
  const [filter, setFilter] = useState<string>(search.tag ?? "all");

  useEffect(() => {
    if (search.tag) setFilter(search.tag);
  }, [search.tag]);

  useEffect(() => {
    (async () => {
      const res = (await listFn()) as { items: Item[] };
      setItems(res.items ?? []);
    })();
  }, [listFn]);

  const inLang = items.filter((i) => i.language === lang);
  const tags = Array.from(new Set(inLang.map((i) => i.symptom_tag).filter(Boolean))) as string[];
  const visible = filter === "all" ? inLang : inLang.filter((i) => i.symptom_tag === filter);

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold mb-2">{t("learn.title")}</h1>
      <p className="text-sm text-muted-foreground mb-4">{t("learn.lead")}</p>

      <TrainingCards />

      <section className="mt-8">
        <h2 className="text-lg font-semibold mb-2">{t("learn.browseHeading")}</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-full border-2 px-3 py-2 text-sm min-h-10 ${filter === "all" ? "border-primary bg-primary/10" : "border-border"}`}
          >
            {t("learn.all")}
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setFilter(tag)}
              className={`rounded-full border-2 px-3 py-2 text-sm min-h-10 capitalize ${filter === tag ? "border-primary bg-primary/10" : "border-border"}`}
            >
              {tag.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        <ul className="space-y-3">
          {visible.map((c) => (
            <li key={c.id} className="rounded-lg border-2 border-border p-4 bg-card">
              <div className="text-xs uppercase text-muted-foreground">{c.symptom_tag?.replace(/_/g, " ")}</div>
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
                  <button
                    type="button"
                    onClick={() => feedbackFn({ data: { training_id: c.id, action_saved: true } }).catch(() => {})}
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-10"
                  >
                    {t("learn.saveAction")}
                  </button>
                </div>
              )}
              {c.body && <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>}
              {c.source_attribution && (
                <p className="mt-2 text-xs text-muted-foreground">{t("learn.source")}: {c.source_attribution}</p>
              )}
            </li>
          ))}
          {visible.length === 0 && <p className="text-muted-foreground">{t("learn.empty")}</p>}
        </ul>
      </section>
    </AppShell>
  );
}