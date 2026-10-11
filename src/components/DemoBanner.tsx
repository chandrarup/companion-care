import { useT } from "@/i18n/I18nProvider";

export function DemoBanner() {
  const { t } = useT();
  return (
    <div
      role="note"
      aria-label="demo notice"
      className="w-full bg-secondary text-secondary-foreground border-b border-border px-4 py-2 text-center"
      style={{ fontSize: "14pt" }}
    >
      {t("app.demoBanner")}
    </div>
  );
}