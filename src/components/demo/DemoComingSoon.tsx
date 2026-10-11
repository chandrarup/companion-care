import { X } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";

export type ComingSoonFeature = {
  name: { en: string; es: string };
  oneLiner: { en: string; es: string };
  steps: { en: string; es: string }[];
};

export function DemoComingSoon({ feature, onClose }: { feature: ComingSoonFeature; onClose: () => void }) {
  const { t, lang } = useT();
  const L = (lang as "en" | "es") === "es" ? "es" : "en";
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-card text-card-foreground border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-5 pt-4">
          <span className="text-xs uppercase tracking-wide text-primary font-semibold">{t("demo.preview.tag")}</span>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-muted"><X size={18} /></button>
        </div>
        <div className="px-5 pb-5">
          <h3 className="mt-2 text-xl font-semibold">{feature.name[L]}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{feature.oneLiner[L]}</p>

          <div className="mt-5 rounded-xl bg-muted p-4 border border-border">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">{t("demo.preview.howItWorks")}</p>
            <ol className="space-y-2">
              {feature.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground inline-flex items-center justify-center text-xs font-semibold">{i + 1}</span>
                  <span>{s[L]}</span>
                </li>
              ))}
            </ol>
          </div>

          <p className="mt-4 text-xs text-muted-foreground italic">{t("demo.preview.fullVersion")}</p>
        </div>
      </div>
    </div>
  );
}
