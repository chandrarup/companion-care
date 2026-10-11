import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useT } from "@/i18n/I18nProvider";

export const Route = createFileRoute("/_authenticated/photos")({
  head: () => ({ meta: [{ title: "Photos — Companion Care" }] }),
  component: () => {
    const { t } = useT();
    return (
      <AppShell>
        <h1 className="text-2xl font-semibold mb-2">{t("photos.title")}</h1>
        <p>{t("photos.placeholder")}</p>
      </AppShell>
    );
  },
});