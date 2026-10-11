import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Check, Plus, AlertTriangle, Mic, CalendarClock, Lock } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useT } from "@/i18n/I18nProvider";
import { getMyHousehold } from "@/lib/household.functions";
import { createDailyLog, hasLoggedToday, listRecentLogs } from "@/lib/daily-log.functions";
import { DailyLogForm, type DailyLogFormValue } from "@/components/DailyLogForm";
import { VoiceLogger } from "@/components/VoiceLogger";
import { InsightsList } from "@/components/InsightsList";
import { CuesPanel } from "@/components/CuesPanel";
import { TrainingCards } from "@/components/TrainingCards";
import { DailyLogReminder } from "@/components/DailyLogReminder";
import { EpisodeForm } from "@/components/EpisodeForm";
import { RedFlagCard } from "@/components/RedFlagCard";
import { isLockedClient } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({ meta: [{ title: "Today — Companion Care" }] }),
  component: Today,
});

type RecentLog = {
  id: string;
  log_date: string;
  mood: string | null;
  sleep_quality: number | null;
  notes: string | null;
  created_at: string;
  log_symptoms: { symptom: string; time_of_day: string | null; antecedent: string | null; outcome: string | null }[];
};

function Today() {
  const { t } = useT();
  const navigate = useNavigate();
  const fn = useServerFn(getMyHousehold);
  const createFn = useServerFn(createDailyLog);
  const listFn = useServerFn(listRecentLogs);
  const loggedFn = useServerFn(hasLoggedToday);
  const [patientName, setPatientName] = useState<string | null>(null);
  const [mode, setMode] = useState<"idle" | "tap" | "voice" | "episode">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [logs, setLogs] = useState<RecentLog[]>([]);
  const [editLockDays, setEditLockDays] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [insightsKey, setInsightsKey] = useState(0);
  const [calming, setCalming] = useState<string[]>([]);
  const [reminderTime, setReminderTime] = useState<string>("18:00");
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(true);
  const [notifyWindow, setNotifyWindow] = useState<{ start: string; end: string }>({
    start: "09:00",
    end: "20:00",
  });
  const [loggedToday, setLoggedToday] = useState(false);
  const [activeFlags, setActiveFlags] = useState<string[]>([]);
  const [oneTapSaving, setOneTapSaving] = useState(false);

  const refreshLogs = useCallback(async () => {
    try {
      const res = await listFn();
      setLogs((res?.logs ?? []) as RecentLog[]);
      setEditLockDays((res as any)?.editLockDays ?? 3);
      const l = await loggedFn();
      setLoggedToday(!!l?.logged);
    } catch (e: any) {
      setError(e?.message ?? "Could not load logs");
    }
  }, [listFn, loggedFn]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fn();
      if (cancelled) return;
      if (!res?.household) {
        navigate({ to: "/onboarding", replace: true });
        return;
      }
      setPatientName(res.patient?.display_name ?? null);
      const hh = res.household as any;
      if (hh?.notify_window_start && hh?.notify_window_end) {
        setNotifyWindow({
          start: String(hh.notify_window_start).slice(0, 5),
          end: String(hh.notify_window_end).slice(0, 5),
        });
      }
      if (hh?.reminder_time) setReminderTime(String(hh.reminder_time).slice(0, 5));
      if (typeof hh?.reminder_enabled === "boolean") setReminderEnabled(hh.reminder_enabled);
      const pat = (res as any).patient;
      if (Array.isArray(pat?.calming_strategies)) setCalming(pat.calming_strategies);
      refreshLogs();
    })();
    return () => {
      cancelled = true;
    };
  }, [fn, navigate, refreshLogs]);

  async function handleSave(v: DailyLogFormValue) {
    setSubmitting(true);
    setError(null);
    try {
      await createFn({ data: v });
      setMode("idle");
      await refreshLogs();
      setInsightsKey((k) => k + 1);
    } catch (e: any) {
      setError(e?.message ?? "Could not save log");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoodDay() {
    if (oneTapSaving) return;
    setOneTapSaving(true);
    setError(null);
    try {
      await createFn({ data: { mood: 5, sleep_quality: null, sleep_hours: null, caregiver_distress: null, notes: "Good day — nothing to report", symptoms: [], quick_ok: true } });
      await refreshLogs();
      setInsightsKey((k) => k + 1);
    } catch (e: any) {
      setError(e?.message ?? "Could not save");
    } finally {
      setOneTapSaving(false);
    }
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold mb-2">{t("today.title")}</h1>
      {patientName && <p className="text-muted-foreground mb-4">— {patientName}</p>}

      <RedFlagCard flags={activeFlags} />

      {error && (
        <div className="mb-4 rounded border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      {mode === "idle" && (
        <motion.div
          className="space-y-6"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
        >
          <DailyLogReminder
            reminderTime={reminderTime}
            windowStart={notifyWindow.start}
            windowEnd={notifyWindow.end}
            enabled={reminderEnabled}
            alreadyLoggedToday={loggedToday}
            onOpen={() => setMode("tap")}
          />

          <CuesPanel />

          {/* Daily check-in: one-tap "good day" first */}
          {!loggedToday && (
            <motion.button
              variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={handleGoodDay}
              disabled={oneTapSaving}
              className="w-full rounded-[20px] bg-primary text-primary-foreground px-6 py-7 text-xl font-medium min-h-24 disabled:opacity-60 inline-flex items-center justify-center gap-3"
            >
              <Check size={22} strokeWidth={2} />
              {oneTapSaving ? "Saving…" : "Good day — nothing to report"}
            </motion.button>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <motion.button
              variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={() => setMode("tap")}
              className="glass-card px-6 py-6 text-lg font-medium min-h-20 inline-flex items-center gap-3 text-left"
            >
              <Plus size={22} strokeWidth={1.75} className="text-primary" />
              Quick check-in
            </motion.button>
            <motion.button
              variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={() => setMode("episode")}
              className="glass-card px-6 py-6 text-lg font-medium min-h-20 inline-flex items-center gap-3 text-left"
            >
              <AlertTriangle size={22} strokeWidth={1.75} style={{ color: "#5E554E" }} />
              Log a symptom
            </motion.button>
            <motion.button
              variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={() => setMode("voice")}
              className="glass-card px-6 py-6 text-lg font-medium min-h-20 inline-flex items-center gap-3 text-left"
            >
              <Mic size={22} strokeWidth={1.75} className="text-primary" />
              Voice log
            </motion.button>
            <motion.div variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }} whileHover={{ y: -2 }}>
            <Link
              to="/cues"
              className="glass-card px-6 py-6 text-lg font-medium min-h-20 flex items-center gap-3"
            >
              <CalendarClock size={22} strokeWidth={1.75} className="text-primary" />
              Cues & reminders
            </Link>
            </motion.div>
          </div>

          <TrainingCards refreshKey={insightsKey} />

          <section aria-labelledby="recent-logs" className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
            <div>
              <h2 id="recent-logs" className="font-semibold">Past logs</h2>
              <p className="text-sm text-muted-foreground">
                {logs.length === 0 ? "Nothing logged yet." : `${logs.length} recent entr${logs.length === 1 ? "y" : "ies"}.`}
              </p>
            </div>
            <Link to="/logs" className="text-sm font-medium text-primary hover:underline">View past logs →</Link>
          </section>

          <section aria-labelledby="insights">
            <h2 id="insights" className="text-lg font-semibold mb-2">
              Insights
            </h2>
            <p className="text-sm text-muted-foreground mb-3">
              Patterns we've noticed from your family's logs. Counts only — never diagnoses.
            </p>
            <InsightsList refreshKey={insightsKey} />
          </section>
        </motion.div>
      )}

      {mode === "tap" && (
        <DailyLogForm
          submitting={submitting}
          onSubmit={handleSave}
          onCancel={() => setMode("idle")}
          onAnySymptomsYes={async (snap) => {
            await handleSave(snap);
            setMode("episode");
          }}
        />
      )}

      {mode === "voice" && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setMode("idle")}
            className="text-sm underline"
          >
            ← Back
          </button>
          <VoiceLogger submitting={submitting} onConfirm={handleSave} />
          <details className="text-sm">
            <summary className="cursor-pointer">Prefer to tap instead?</summary>
            <div className="mt-3">
              <DailyLogForm submitting={submitting} onSubmit={handleSave} />
            </div>
          </details>
        </div>
      )}

      {mode === "episode" && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setMode("idle")}
            className="text-sm underline"
          >
            ← Back
          </button>
          <h2 className="text-xl font-semibold">Log a symptom</h2>
          <EpisodeForm
            calmingSuggestions={calming}
            onCancel={() => setMode("idle")}
            onSaved={(res) => {
              setMode("idle");
              setInsightsKey((k) => k + 1);
              if (res.red_flags.length > 0) setActiveFlags(res.red_flags);
            }}
          />
        </div>
      )}
    </AppShell>
  );
}