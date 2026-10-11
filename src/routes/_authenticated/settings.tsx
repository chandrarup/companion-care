import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useT } from "@/i18n/I18nProvider";
import { getMyHousehold, updateHouseholdSettings } from "@/lib/household.functions";
import { VoiceCloneCard } from "@/components/VoiceCloneCard";
import { getMusicSettings, updateMusicProvider } from "@/lib/music.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Companion Care" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useT();
  const getHh = useServerFn(getMyHousehold);
  const saveHh = useServerFn(updateHouseholdSettings);
  const getMusic = useServerFn(getMusicSettings);
  const saveMusic = useServerFn(updateMusicProvider);
  const [musicProvider, setMusicProvider] = useState<string | "">("");
  const [reminderTime, setReminderTime] = useState("18:00");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [editLockDays, setEditLockDays] = useState(2);
  const [windowStart, setWindowStart] = useState("09:00");
  const [windowEnd, setWindowEnd] = useState("20:00");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const res = await getHh();
      if (cancel) return;
      const hh = (res as any)?.household;
      if (!hh) return;
      if (hh.reminder_time) setReminderTime(String(hh.reminder_time).slice(0, 5));
      if (typeof hh.reminder_enabled === "boolean") setReminderEnabled(hh.reminder_enabled);
      if (typeof hh.edit_lock_days === "number") setEditLockDays(hh.edit_lock_days);
      if (hh.notify_window_start) setWindowStart(String(hh.notify_window_start).slice(0, 5));
      if (hh.notify_window_end) setWindowEnd(String(hh.notify_window_end).slice(0, 5));
      try {
        const ms: any = await getMusic();
        if (ms?.provider) setMusicProvider(ms.provider);
      } catch {}
    })();
    return () => { cancel = true; };
  }, [getHh, getMusic]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      await saveHh({ data: {
        reminder_time: reminderTime,
        reminder_enabled: reminderEnabled,
        edit_lock_days: editLockDays,
        notify_window_start: windowStart,
        notify_window_end: windowEnd,
      } });
      setStatus("Saved");
    } catch (err: any) {
      setStatus(err?.message ?? "Could not save");
    } finally { setSaving(false); }
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold mb-4">{t("settings.title")}</h1>

      <section className="space-y-2 mb-6">
        <h2 className="font-medium">{t("settings.language")}</h2>
        <LanguageToggle />
      </section>

      <section className="space-y-3 mb-6">
        <h2 className="font-medium">{t("settings.dailyCheckin")}</h2>
        <form onSubmit={onSave} className="space-y-3 rounded-md border p-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={reminderEnabled} onChange={(e) => setReminderEnabled(e.target.checked)} className="h-5 w-5" />
            <span>{t("settings.reminderEnabled")}</span>
          </label>
          <label className="block text-sm">
            {t("settings.reminderTime")}
            <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} className="mt-1 block w-40 rounded border px-2 py-2 min-h-10" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              {t("settings.windowStart")}
              <input type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} className="mt-1 block w-full rounded border px-2 py-2 min-h-10" />
            </label>
            <label className="block text-sm">
              {t("settings.windowEnd")}
              <input type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} className="mt-1 block w-full rounded border px-2 py-2 min-h-10" />
            </label>
          </div>
          <label className="block text-sm">
            {t("settings.editLockDays")}
            <input type="number" min={0} max={30} value={editLockDays} onChange={(e) => setEditLockDays(Number(e.target.value) || 0)} className="mt-1 block w-32 rounded border px-2 py-2 min-h-10" />
            <span className="block mt-1 text-xs text-muted-foreground">{t("settings.editLockHelp")}</span>
          </label>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="rounded-md bg-primary text-primary-foreground px-4 py-2 min-h-10 font-medium disabled:opacity-50">
              {saving ? "Saving…" : t("common.save")}
            </button>
            {status && <span className="text-sm text-muted-foreground">{status}</span>}
          </div>
        </form>
      </section>

      <section className="space-y-2 mb-6">
        <h2 className="font-medium">{t("settings.patientProfile")}</h2>
        <p className="text-sm text-muted-foreground">{t("settings.editPatientProfile")}</p>
        <Link
          to="/onboarding"
          className="inline-block px-4 py-2 rounded-md border border-border bg-card min-h-12"
          data-touch
        >
          {t("intake.dashboard.edit")} →
        </Link>
      </section>

      <VoiceCloneCard />

      <section className="space-y-2 mb-6">
        <h2 className="font-medium">{t("settings.musicProvider")}</h2>
        <p className="text-sm text-muted-foreground">{t("settings.musicProviderHelp")}</p>
        <div className="grid grid-cols-2 gap-2 max-w-md">
          {([
            ["apple", t("settings.providerApple")],
            ["spotify", t("settings.providerSpotify")],
            ["amazon", t("settings.providerAmazon")],
            ["upload", t("settings.providerUpload")],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={async () => {
                setMusicProvider(key);
                try { await saveMusic({ data: { provider: key } }); } catch {}
              }}
              className={`rounded-md border-2 px-3 py-3 text-sm min-h-12 ${musicProvider === key ? "border-primary bg-primary/10" : "border-border"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-1 opacity-70">
        <h2 className="font-medium">{t("settings.caregiverWellbeing")}</h2>
        <p className="text-sm text-muted-foreground">{t("settings.caregiverWellbeingHelp")}</p>
      </section>
    </AppShell>
  );
}
