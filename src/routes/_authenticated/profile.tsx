import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { useT } from "@/i18n/I18nProvider";
import { getMyHousehold } from "@/lib/household.functions";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — Companion Care" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useT();
  const fn = useServerFn(getMyHousehold);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    fn().then((r) => {
      if (!cancelled) setData(r);
    });
    return () => {
      cancelled = true;
    };
  }, [fn]);

  const p = data?.patient;

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold mb-4">{t("profile.title")}</h1>
      {!p ? (
        <p>{t("common.loading")}</p>
      ) : (
        <dl className="space-y-4">
          <Row label={t("profile.biography")} value={p.biography || "—"} />
          <Row label={t("profile.dailyRoutines")} value={p.daily_routines || "—"} />
          <Row label={t("profile.music")} value={(p.music_preferences ?? []).join(", ") || "—"} />
          <Row label={t("profile.triggers")} value={(p.known_triggers ?? []).join(", ") || "—"} />
        </dl>
      )}
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium">{label}</dt>
      <dd className="text-muted-foreground whitespace-pre-wrap">{value}</dd>
    </div>
  );
}