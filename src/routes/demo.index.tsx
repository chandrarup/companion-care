import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, User } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";

export const Route = createFileRoute("/demo/")({
  component: DemoChooser,
});

function DemoChooser() {
  const { t } = useT();
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-semibold">{t("demo.chooser.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("demo.chooser.subtitle")}</p>
      </div>
      <div className="grid gap-4">
        <ChooseCard to="/demo/patient" icon={<User className="h-7 w-7" />} title={t("demo.chooser.patient")} desc={t("demo.chooser.patientDesc")} />
        <ChooseCard to="/demo/caregiver" icon={<Heart className="h-7 w-7" />} title={t("demo.chooser.caregiver")} desc={t("demo.chooser.caregiverDesc")} />
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">{t("demo.chooser.foot")}</p>
    </div>
  );
}

function ChooseCard({ to, icon, title, desc }: { to: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link
      to={to}
      className="group w-full text-left rounded-2xl border border-border bg-card p-6 transition hover:border-primary/40 hover:shadow-md active:scale-[0.99]"
    >
      <div className="flex items-start gap-4">
        <div className="rounded-xl bg-primary/10 text-primary p-3">{icon}</div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-1 text-muted-foreground">{desc}</p>
        </div>
      </div>
    </Link>
  );
}
