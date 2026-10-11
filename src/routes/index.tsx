import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BrandLink } from "@/components/BrandLink";
import { useEffect, useState } from "react";
import { Heart, User, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/I18nProvider";
import { LanguageToggle } from "@/components/LanguageToggle";
import { InfoDot } from "@/components/InfoDot";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Companion Care" },
      { name: "description", content: "A calm companion for people living with early-to-mid stage Alzheimer's or dementia — and the families who care for them." },
      { property: "og:title", content: "Companion Care" },
      { property: "og:description", content: "A calm companion for people living with early-to-mid stage Alzheimer's or dementia — and the families who care for them." },
    ],
  }),
  component: Welcome,
});

const ROLE_KEY = "companion.signupRole";

function Welcome() {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session) {
          // Opened via the logo (?home=1): stay on the home page. Otherwise go straight into the app.
          if (new URLSearchParams(window.location.search).get("home")) {
            setSignedIn(true);
          } else {
            navigate({ to: "/today", replace: true });
            return;
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  function choose(role: "caregiver" | "patient") {
    try { window.localStorage.setItem(ROLE_KEY, role); } catch {}
    navigate({ to: "/auth" });
  }

  if (checking) {
    return <div className="min-h-dvh flex items-center justify-center bg-background text-foreground"><p>{t("common.loading")}</p></div>;
  }

  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
          <BrandLink size={28} name={t("app.name")} nameClassName="font-semibold tracking-wide truncate" />
          <LanguageToggle />
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-10">
            {signedIn && (
              <a href="/today" className="mb-6 flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 min-h-12 font-medium text-primary-foreground">
                {lang === "es" ? "Continuar a mi panel →" : "Continue to my dashboard →"}
              </a>
            )}
            <Logo size={96} className="mx-auto mb-5" />
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">{t("welcome.title")}</h1>
            <p className="mt-3 text-lg text-muted-foreground">{t("welcome.tagline")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-1">
            <RoleCard
              icon={<Heart className="h-7 w-7" aria-hidden />}
              title={t("welcome.caregiverTitle")}
              desc={t("welcome.caregiverDesc")}
              onClick={() => choose("caregiver")}
            />
            <RoleCard
              icon={<User className="h-7 w-7" aria-hidden />}
              title={t("welcome.patientTitle")}
              desc={t("welcome.patientDesc")}
              onClick={() => choose("patient")}
            />
            <RoleCard
              icon={<Sparkles className="h-7 w-7" aria-hidden />}
              title={t("welcome.demoTitle")}
              desc={t("welcome.demoDesc")}
              onClick={() => navigate({ to: "/demo" })}
              info={
                <InfoDot label={t("welcome.demoTitle")}>
                  <p>
                    {t("welcome.demoInfo")}
                  </p>
                </InfoDot>
              }
            />
          </div>
        </div>
      </main>
      <footer className="border-t border-border bg-card">
        <div className="mx-auto max-w-3xl px-4 py-3 text-xs text-muted-foreground flex justify-center">
          <a href="/trust" className="hover:text-foreground underline-offset-4 hover:underline">
            Trust &amp; Privacy
          </a>
        </div>
      </footer>
    </div>
  );
}

function RoleCard({ icon, title, desc, onClick, muted, info }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void; muted?: boolean; info?: React.ReactNode }) {
  return (
    // A div, not a button: the card can contain the InfoDot button, and buttons can't nest.
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`group w-full cursor-pointer text-left rounded-2xl border border-border bg-card p-6 transition hover:border-primary/40 hover:shadow-md active:scale-[0.99] ${muted ? "opacity-80" : ""}`}
      data-touch
    >
      <div className="flex items-start gap-4">
        <div className="rounded-xl bg-primary/10 text-primary p-3">{icon}</div>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="text-xl font-semibold">{title}</h2>
            {info}
          </div>
          <p className="mt-1 text-muted-foreground">{desc}</p>
        </div>
      </div>
    </div>
  );
}
