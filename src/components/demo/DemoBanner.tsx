import { useT } from "@/i18n/I18nProvider";
import { Link } from "@tanstack/react-router";

export function DemoBanner({ onExit }: { onExit?: () => void }) {
  const { t } = useT();
  return (
    <div className="w-full bg-tint text-tint-foreground border-b border-border px-4 py-2 text-sm flex items-center justify-between gap-3" role="note">
      <span className="font-medium truncate">{t("demo.banner")}</span>
      <Link
        to="/"
        onClick={onExit}
        className="shrink-0 rounded-md border border-border px-3 py-2.5 min-h-11 inline-flex items-center text-sm font-medium hover:bg-muted"
      >
        {t("demo.exit")}
      </Link>
    </div>
  );
}
