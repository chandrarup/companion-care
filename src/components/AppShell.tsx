import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { BrandLink } from "@/components/BrandLink";
import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Sun,
  Image as ImageIcon,
  PlayCircle,
  Users,
  ClipboardList,
  Settings as SettingsIcon,
  Heart,
} from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { useMode } from "@/lib/mode-context";
import { LanguageToggle } from "./LanguageToggle";
import { DemoBanner } from "./DemoBanner";
import { PinDialog } from "./PinDialog";
import { Logo } from "./Logo";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { verifyHouseholdPin } from "@/lib/household.functions";
import { unlockAudio } from "@/lib/caregiver-voice";

const navItems = [
  { to: "/today", key: "nav.today", Icon: Sun },
  { to: "/photos", key: "nav.photos", Icon: ImageIcon },
  { to: "/learn", key: "nav.learn", Icon: PlayCircle },
  { to: "/circle", key: "nav.circle", Icon: Users },
  { to: "/summary", key: "nav.summary", Icon: ClipboardList },
  { to: "/settings", key: "nav.settings", Icon: SettingsIcon },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useT();
  const { mode, setMode } = useMode();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [pinOpen, setPinOpen] = useState(false);
  const verifyPinFn = useServerFn(verifyHouseholdPin);
  const [night, setNight] = useState(false);

  useEffect(() => {
    const update = () => {
      const h = new Date().getHours();
      setNight(h >= 19 || h < 6);
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (night) root.setAttribute("data-time", "night");
    else root.removeAttribute("data-time");
    return () => root.removeAttribute("data-time");
  }, [night]);

  async function handleModeButton() {
    if (mode === "caregiver") {
      // Going INTO patient mode: no PIN required. This tap also unlocks audio for reminders that fire on their own.
      unlockAudio();
      setMode("patient");
      router.navigate({ to: "/patient" });
    } else {
      // Going back to caregiver: require PIN.
      setPinOpen(true);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  }

  return (
    <div
      data-mode="caregiver"
      data-surface="caregiver"
      data-time={night ? "night" : "day"}
      className="min-h-screen flex flex-col lg:flex-row"
    >
      <div className="lg:hidden">
        <DemoBanner />
      </div>
      <header className="border-b border-border bg-card lg:hidden" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-2 sm:gap-3">
          <BrandLink size={30} name={t("app.name")} collapseNameOnPhone />
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <LanguageToggle />
            <button
              type="button"
              onClick={handleModeButton}
              className="px-2.5 sm:px-3 py-2 rounded-xl border-2 border-foreground bg-card text-foreground text-xs sm:text-sm font-semibold active:scale-[0.97] transition-transform whitespace-nowrap"
              data-touch
              aria-label={mode === "caregiver" ? t("mode.switchToPatient") : t("mode.switchToCaregiver")}
            >
              {mode === "caregiver" ? "→ " + t("mode.patient") : "← " + t("mode.caregiver")}
            </button>
            <button
              type="button"
              onClick={signOut}
              className="px-2.5 sm:px-3 py-2 rounded-xl border border-border bg-background text-xs sm:text-sm font-medium whitespace-nowrap"
              data-touch
            >
              {t("auth.signOut")}
            </button>
          </div>
        </div>
      </header>

      {/* Desktop sidebar nav */}
      <aside
        aria-label="primary"
        className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:border-r lg:border-border lg:bg-card lg:sticky lg:top-0 lg:h-screen"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-5 py-4 border-b border-border">
          <BrandLink size={28} name={t("app.name")} />
        </div>
        <ul className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.to);
            const { Icon } = item;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  data-touch
                  aria-current={active ? "page" : undefined}
                  className={
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors " +
                    (active
                      ? "bg-tint text-tint-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50")
                  }
                >
                  <Icon aria-hidden size={20} strokeWidth={1.75} />
                  <span>{t(item.key)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="px-3 py-4 border-t border-border space-y-2">
          <div className="flex items-center justify-between gap-2 px-1">
            <LanguageToggle />
          </div>
          <button
            type="button"
            onClick={handleModeButton}
            className="w-full px-3 py-2 rounded-xl border-2 border-foreground bg-card text-foreground text-sm font-semibold"
            data-touch
          >
            {mode === "caregiver" ? "→ " + t("mode.patient") : "← " + t("mode.caregiver")}
          </button>
          <button
            type="button"
            onClick={signOut}
            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-medium"
            data-touch
          >
            {t("auth.signOut")}
          </button>
        </div>
      </aside>

      {/* Content column: on desktop the notice sits above the page, beside (not before) the sidebar. */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="hidden lg:block">
          <DemoBanner />
        </div>
        <main
          className="flex-1 mx-auto w-full max-w-3xl lg:max-w-6xl px-4 sm:px-6 py-6 pb-28 lg:pb-10"
          style={{
            paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))",
            paddingRight: "max(1rem, env(safe-area-inset-right, 0px))",
          }}
        >
          {children}
        </main>
      </div>

      <nav
        aria-label="primary"
        className="fixed bottom-0 inset-x-0 border-t border-border bg-card lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <ul className="mx-auto max-w-3xl grid grid-cols-6 px-1">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.to);
            const { Icon } = item;
            return (
              <li key={item.to} className="relative">
                <Link
                  to={item.to}
                  data-touch
                  aria-current={active ? "page" : undefined}
                  className={
                    "flex flex-col items-center justify-center py-2.5 gap-1 text-[10px] sm:text-xs leading-tight transition-colors min-w-0 " +
                    (active ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground")
                  }
                >
                  <Icon aria-hidden size={22} strokeWidth={1.75} />
                  <span className="truncate max-w-full px-0.5">{t(item.key)}</span>
                </Link>
                {active && (
                  <motion.span
                    layoutId="nav-active-indicator"
                    aria-hidden
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-10 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <PinDialog
        open={pinOpen}
        onCancel={() => setPinOpen(false)}
        onVerify={async (pin) => {
          const res = await verifyPinFn({ data: { pin } });
          if (res.ok) {
            setMode("caregiver");
            setPinOpen(false);
            router.navigate({ to: "/today" });
            return true;
          }
          return false;
        }}
      />
    </div>
  );
}