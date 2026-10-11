import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Sun, Image as ImageIcon, PlayCircle, Users, ClipboardList, Settings as SettingsIcon, FileText, Phone, ChevronRight, Sparkles, AlertCircle, MessageCircle, Camera, BookOpen } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { ROSA, DEMO_LOGS, DEMO_INSIGHTS, DEMO_CUES, DEMO_PHOTOS, DEMO_PEOPLE } from "@/lib/demo/data";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { DemoReminder, DemoShowReminderButton } from "@/components/demo/DemoReminder";
import { DemoAsk } from "@/components/demo/DemoAsk";
import { PhotoCard } from "@/components/demo/PhotoCard";
import { useDemoPhotos, addDemoPhoto, removeDemoPhoto } from "@/lib/demo/photos-store";
import { DemoComingSoon, type ComingSoonFeature } from "@/components/demo/DemoComingSoon";
import { DemoEpisodeForm } from "@/components/demo/DemoEpisodeForm";
import { DemoCaregiverDailyLogForm } from "@/components/demo/DemoCaregiverDailyLogForm";
import { DemoCareHandoffButton } from "@/components/demo/DemoCareHandoff";
import { DemoFamiliarVoiceCard } from "@/components/demo/DemoFamiliarVoiceCard";
import { DemoRedFlagBanner, DemoEmergencyButton, DemoWhereIsRosa } from "@/components/demo/DemoSafety";
import { DemoResources } from "@/components/demo/DemoResources";
import { useDemoEntries, type DemoEntry } from "@/lib/demo/log-store";
import { InfoDot } from "@/components/InfoDot";

const TAB_INFO: Record<"today" | "photos" | "learn" | "circle" | "summary", { en: string; es: string }> = {
  today: {
    en: "Today is the daily hub — mood, sleep, what helped, and any difficult moments worth logging.",
    es: "Hoy es el centro diario — ánimo, sueño, qué ayudó y cualquier momento difícil para registrar.",
  },
  photos: {
    en: "Familiar faces and places that calm the person — they appear in Patient Mode and in memory cues.",
    es: "Caras y lugares familiares que calman a la persona — aparecen en el Modo Paciente y como pistas.",
  },
  learn: {
    en: "Short, evidence-informed lessons picked from the patterns we see in your logs.",
    es: "Lecciones breves basadas en evidencia, elegidas según los patrones de tus registros.",
  },
  circle: {
    en: "The people around the person — family, friends, clinicians — each with the right level of access.",
    es: "Las personas alrededor — familia, amigos, médicos — cada uno con el acceso adecuado.",
  },
  summary: {
    en: "A clinician-ready snapshot you can print or share before the next visit.",
    es: "Un resumen listo para el médico — puedes imprimirlo o compartirlo antes de la próxima visita.",
  },
};

export const Route = createFileRoute("/demo/caregiver")({
  component: DemoCaregiver,
});

const COMING_SOON: Record<string, ComingSoonFeature> = {
  voice: {
    name: { en: "Voice log", es: "Registro por voz" },
    oneLiner: { en: "Speak your update — we transcribe and tag it.", es: "Habla tu actualización — transcribimos y etiquetamos." },
    steps: [
      { en: "Tap to record a sentence about today.", es: "Toca para grabar una frase sobre hoy." },
      { en: "We pick out mood, sleep, and any symptoms.", es: "Detectamos ánimo, sueño y síntomas." },
      { en: "Confirm or edit — saved to today's log.", es: "Confirma o edita — guardado al registro de hoy." },
    ],
  },
  episode: {
    name: { en: "Log a difficult moment", es: "Registrar un momento difícil" },
    oneLiner: { en: "Capture what happened, what triggered it, and what helped.", es: "Captura qué pasó, qué lo desencadenó y qué ayudó." },
    steps: [
      { en: "Pick the symptom (agitation, repetition, etc).", es: "Elige el síntoma (agitación, repetición, etc)." },
      { en: "Add the antecedent and outcome.", es: "Agrega el antecedente y el resultado." },
      { en: "We weave it into the pattern engine.", es: "Lo añadimos al motor de patrones." },
    ],
  },
  photos: {
    name: { en: "Photo library", es: "Galería de fotos" },
    oneLiner: { en: "Upload familiar faces. Captions become memory cues.", es: "Sube caras familiares. Las leyendas se vuelven pistas." },
    steps: [
      { en: "Drag in photos from your phone.", es: "Arrastra fotos desde tu teléfono." },
      { en: "Add who, when, where for each.", es: "Agrega quién, cuándo y dónde." },
      { en: "They appear in Patient Mode's slideshow.", es: "Aparecen en el carrusel del Modo Paciente." },
    ],
  },
  learn: {
    name: { en: "Learn library", es: "Biblioteca de aprendizaje" },
    oneLiner: { en: "Short videos and one-tip cards picked from the patterns we see.", es: "Videos cortos y consejos elegidos por los patrones que vemos." },
    steps: [
      { en: "We surface lessons that match this week's logs.", es: "Mostramos lecciones que coinciden con los registros de la semana." },
      { en: "2-minute videos with cited sources.", es: "Videos de 2 min con fuentes citadas." },
      { en: '"I tried this" closes the loop for better picks.', es: '"Lo probé" mejora futuras recomendaciones.' },
    ],
  },
  circle: {
    name: { en: "Care circle", es: "Círculo de cuidado" },
    oneLiner: { en: "Invite family, friends, and the clinician with the right level of access.", es: "Invita a familia, amigos y al médico con el acceso correcto." },
    steps: [
      { en: "Email invite with role: caregiver, family, or clinician.", es: "Invita por correo con un rol: cuidador, familia o médico." },
      { en: "Each role sees only what they need.", es: "Cada rol ve solo lo que necesita." },
      { en: "Clinician sees the read-only summary.", es: "El médico ve el resumen de solo lectura." },
    ],
  },
  summary: {
    name: { en: "Physician summary", es: "Resumen médico" },
    oneLiner: { en: "A one-page snapshot for the next visit.", es: "Un resumen de una página para la próxima visita." },
    steps: [
      { en: "Pick a date range.", es: "Elige un rango de fechas." },
      { en: "We turn logs into counts, trends, and a plain summary.", es: "Convertimos los registros en conteos, tendencias y un resumen claro." },
      { en: "Print or share with the clinician.", es: "Imprime o comparte con el médico." },
    ],
  },
};

type TabKey = "today" | "photos" | "learn" | "circle" | "summary" | "settings";

function DemoCaregiver() {
  const { t, lang } = useT();
  const L = (lang as "en" | "es") === "es" ? "es" : "en";
  const [preview, setPreview] = useState<ComingSoonFeature | null>(null);
  const [tab, setTab] = useState<TabKey>("today");
  const [episodeOpen, setEpisodeOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  const tabs: { key: TabKey; label: string; Icon: any }[] = [
    { key: "today",    label: t("nav.today"),    Icon: Sun },
    { key: "photos",   label: t("nav.photos"),   Icon: ImageIcon },
    { key: "learn",    label: t("nav.learn"),    Icon: PlayCircle },
    { key: "circle",   label: t("nav.circle"),   Icon: Users },
    { key: "summary",  label: t("nav.summary"),  Icon: ClipboardList },
    { key: "settings", label: t("nav.settings"), Icon: SettingsIcon },
  ];

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100dvh-90px)]">
      <DemoReminder mode="caregiver" />
      <DemoAsk mode="caregiver" context={tab === "summary" ? "physician" : "caregiver"} />
      {episodeOpen && <DemoEpisodeForm source="caregiver" onClose={() => setEpisodeOpen(false)} />}
      {noteOpen && (
        <DemoCaregiverDailyLogForm
          onClose={() => setNoteOpen(false)}
          onOpenEpisode={() => setEpisodeOpen(true)}
        />
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:shrink-0 lg:border-r lg:border-border lg:bg-card">
        <div className="px-5 py-5 border-b border-border">
          <p className="text-xs text-muted-foreground">{t("demo.caregiver.today")}</p>
          <p className="font-semibold">{ROSA.name}</p>
        </div>
        <ul className="flex-1 px-3 py-4 space-y-1">
          {tabs.map(({ key, label, Icon }) => {
            const active = tab === key;
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => setTab(key)}
                  aria-current={active ? "page" : undefined}
                  className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors " + (active ? "bg-tint text-tint-foreground font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}
                >
                  <Icon aria-hidden size={20} strokeWidth={1.75} />
                  <span>{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="px-3 py-4 border-t border-border">
          <Link to="/demo/patient" className="block text-center rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium hover:border-primary/40">{t("demo.caregiver.openPatient")}</Link>
        </div>
      </aside>

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 sm:px-6 py-6 pb-28 lg:pb-24">
        {tab === "today" && (
          <TodayTab L={L} t={t} setPreview={setPreview}
            openEpisode={() => setEpisodeOpen(true)}
            openNote={() => setNoteOpen(true)}
          />
        )}
        {tab === "photos" && <PhotosTab L={L} setPreview={setPreview} />}
        {tab === "learn" && <LearnTab L={L} setPreview={setPreview} />}
        {tab === "circle" && <CircleTab L={L} setPreview={setPreview} />}
        {tab === "summary" && <SummaryTab L={L} setPreview={setPreview} />}
        {tab === "settings" && <SettingsTab L={L} />}
      </main>

      {/* Mobile bottom tab bar */}
      <nav aria-label="primary" className="fixed bottom-0 inset-x-0 z-20 border-t border-border bg-card lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <ul className="mx-auto max-w-3xl grid grid-cols-6 px-1">
          {tabs.map(({ key, label, Icon }) => {
            const active = tab === key;
            return (
              <li key={key} className="relative">
                <button
                  type="button"
                  onClick={() => setTab(key)}
                  aria-current={active ? "page" : undefined}
                  className={"w-full flex flex-col items-center justify-center py-2.5 gap-1 text-[10px] sm:text-xs leading-tight transition-colors min-w-0 " + (active ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground")}
                >
                  <Icon aria-hidden size={22} strokeWidth={1.75} />
                  <span className="truncate max-w-full px-0.5">{label}</span>
                </button>
                {active && (
                  <motion.span layoutId="demo-nav-indicator" aria-hidden className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-10 rounded-full bg-primary" transition={{ type: "spring", stiffness: 380, damping: 30 }} />
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {preview && <DemoComingSoon feature={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function TodayTab({ L, t, setPreview, openEpisode, openNote }: { L: "en" | "es"; t: (k: string) => string; setPreview: (f: ComingSoonFeature) => void; openEpisode: () => void; openNote: () => void }) {
  const today = DEMO_LOGS[0];
  const liveEntries = useDemoEntries();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span>{t("nav.today")}</span>
        <InfoDot label={t("nav.today")}><p>{TAB_INFO.today[L]}</p></InfoDot>
      </div>
      <DemoRedFlagBanner L={L} />
      <div className="flex flex-wrap items-end justify-between gap-3 lg:hidden">
        <div>
          <p className="text-sm text-muted-foreground">{t("demo.caregiver.today")}</p>
          <h1 className="text-3xl font-semibold">{ROSA.name}</h1>
          <p className="text-sm text-muted-foreground">{ROSA.diagnosis} · {L === "es" ? "diagnosticada hace" : "diagnosed"} {ROSA.diagnosedYears} {L === "es" ? "años" : "years ago"}</p>
        </div>
        <Link to="/demo/patient" className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium hover:border-primary/40">{t("demo.caregiver.openPatient")}</Link>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{t("demo.caregiver.todayTitle")}</h2>
            <p className="text-sm text-muted-foreground mt-1">{today.notes[L]}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Tag>{L === "es" ? "Ánimo" : "Mood"} {today.mood}/5</Tag>
              <Tag>{L === "es" ? "Sueño" : "Sleep"}: {today.sleep}</Tag>
              {today.symptoms.map((s, i) => <Tag key={i}>{s.name[L]}</Tag>)}
            </div>
          </div>
          <Link to="/demo/logs" className="shrink-0 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            {t("demo.caregiver.viewPast")} <ChevronRight size={16} />
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">{t("demo.caregiver.actions")}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ActionTile icon={<MessageCircle />} label={L === "es" ? "Anotar el día" : "Add daily log"} onClick={openNote} />
          <ActionTile icon={<AlertCircle />} label={L === "es" ? "Registrar episodio" : "Log an episode"} onClick={openEpisode} />
          <ActionTile icon={<Camera />} label={L === "es" ? "Fotos" : "Photos"} onClick={() => setPreview(COMING_SOON.photos)} />
          <ActionTile icon={<BookOpen />} label={L === "es" ? "Aprender" : "Learn"} onClick={() => setPreview(COMING_SOON.learn)} />
        </div>
        <div className="mt-3 flex justify-end">
          <DemoShowReminderButton
            label={L === "es" ? "Mostrar recordatorio" : "Show reminder"}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40"
          />
        </div>
      </section>

      {liveEntries.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            {L === "es" ? "Añadido hoy" : "Added today"}
          </h2>
          <ul className="space-y-2">
            {liveEntries.slice(0, 5).map((e) => (
              <li key={e.id} className="rounded-xl border border-border bg-card p-3 text-sm">
                <LiveEntry e={e} L={L} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 inline-flex items-center gap-1.5">
          {t("demo.caregiver.insights")}
          <InfoDot label={t("demo.caregiver.insights")}>
            <p>{L === "es"
              ? "Estos patrones se detectan automáticamente a partir de los registros, una vez que hay suficientes entradas."
              : "These patterns are detected automatically from logged data, once there are enough entries."}</p>
          </InfoDot>
        </h2>
        <div className="grid md:grid-cols-2 gap-3">
          {DEMO_INSIGHTS.map((ins) => (
            <motion.div key={ins.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-muted text-foreground p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide"><Sparkles size={14} /> {L === "es" ? "Patrón detectado" : "Pattern detected"}</div>
              <h3 className="mt-2 text-lg font-semibold">{ins.title[L]}</h3>
              <p className="mt-1 text-sm">{ins.body[L]}</p>
              <p className="mt-3 text-sm font-medium">{ins.suggestion[L]}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">{t("demo.caregiver.cues")}</h2>
        <ul className="grid sm:grid-cols-3 gap-3">
          {DEMO_CUES.map((c) => (
            <li key={c.id} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-2xl font-semibold">{c.time}</p>
              <p className="mt-1 font-medium">{c.label[L]}</p>
              <p className="text-xs text-muted-foreground mt-1">{c.why[L]}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function PhotosTab({ L }: { L: "en" | "es"; setPreview?: (f: ComingSoonFeature) => void }) {
  const photos = useDemoPhotos();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!pending) return;
    setBusy(true);
    setErr(null);
    try {
      await addDemoPhoto(pending, caption);
      setPending(null);
      setCaption("");
    } catch {
      setErr(L === "es" ? "No pudimos usar ese archivo. Prueba con otra foto." : "We couldn't use that file. Please try another photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold inline-flex items-center gap-1.5">
          {L === "es" ? "Galería" : "Photos"}
          <InfoDot label={L === "es" ? "Galería" : "Photos"}><p>{TAB_INFO.photos[L]}</p></InfoDot>
        </h2>
        <button type="button" onClick={() => fileRef.current?.click()} className="min-h-11 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
          {L === "es" ? "+ Añadir foto" : "+ Add photo"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPending(f); setErr(null); } e.target.value = ""; }}
        />
      </div>

      {pending && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <p className="text-sm text-muted-foreground">{pending.name}</p>
          <label className="block">
            <span className="block text-sm mb-1">{L === "es" ? "¿Quién o qué aparece? (opcional)" : "Who or what is in this photo? (optional)"}</span>
            <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={80} autoFocus
              placeholder={L === "es" ? "p. ej. Rosa y María en el jardín" : "e.g. Rosa and María in the garden"}
              className="w-full rounded-lg border border-border bg-background px-3 py-3" />
          </label>
          {err && <p role="alert" className="text-sm text-destructive">✕ {err}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={busy} className="min-h-11 px-4 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50">
              {busy ? (L === "es" ? "Guardando…" : "Saving…") : (L === "es" ? "Guardar foto" : "Save photo")}
            </button>
            <button type="button" onClick={() => { setPending(null); setCaption(""); }} className="min-h-11 px-4 rounded-lg border border-border">
              {L === "es" ? "Cancelar" : "Cancel"}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {photos.map((p) => (
          <div key={p.id} className="relative">
            <PhotoCard photo={p} lang={L} size="md" />
            {p.added && (
              <button type="button" onClick={() => removeDemoPhoto(p.id)} aria-label={L === "es" ? "Quitar foto" : "Remove photo"}
                className="absolute top-2 right-2 h-9 w-9 rounded-full bg-black/55 text-primary-foreground text-lg leading-none">×</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function LearnTab({ L, setPreview }: { L: "en" | "es"; setPreview: (f: ComingSoonFeature) => void }) {
  const cards = [
    { title: { en: "Sundowning: gentle hand-off", es: "Sundowning: transición suave" }, body: { en: "Why Rosa's 3 PM clock fires, and how music + dim light helps.", es: "Por qué se activa el reloj de las 3 PM y cómo música + luz tenue ayudan." } },
    { title: { en: "Responding to repeated questions", es: "Responder a preguntas repetidas" }, body: { en: "Answer calmly, then redirect — never correct.", es: "Responde con calma y redirige — nunca corrijas." } },
    { title: { en: "Bathing without battles", es: "Bañarse sin pelear" }, body: { en: "Predictable, warm, short. A familiar washcloth in hand.", es: "Predecible, cálido, breve. Una toallita familiar en la mano." } },
  ];
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold inline-flex items-center gap-1.5">
        {L === "es" ? "Biblioteca de aprendizaje" : "Learn library"}
        <InfoDot label={L === "es" ? "Aprender" : "Learn"}><p>{TAB_INFO.learn[L]}</p></InfoDot>
      </h2>
      <ul className="space-y-3">
        {cards.map((c, i) => (
          <li key={i} className="rounded-2xl border border-border bg-card p-4 flex items-start gap-3">
            <span className="h-10 w-10 rounded-full bg-tint text-tint-foreground inline-flex items-center justify-center shrink-0"><PlayCircle size={20} /></span>
            <div className="flex-1">
              <p className="font-semibold">{c.title[L]}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{c.body[L]}</p>
              <button onClick={() => setPreview(COMING_SOON.learn)} className="mt-2 text-xs text-primary hover:underline">{L === "es" ? "Ver (2 min)" : "Watch (2 min)"}</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CircleTab({ L, setPreview }: { L: "en" | "es"; setPreview: (f: ComingSoonFeature) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold inline-flex items-center gap-1.5">
          {L === "es" ? "Círculo de cuidado" : "Care circle"}
          <InfoDot label={L === "es" ? "Círculo" : "Circle"}><p>{TAB_INFO.circle[L]}</p></InfoDot>
        </h2>
        <button onClick={() => setPreview(COMING_SOON.circle)} className="text-sm text-primary hover:underline">{L === "es" ? "Invitar" : "Invite"}</button>
      </div>
      <ul className="grid sm:grid-cols-2 gap-2">
        {DEMO_PEOPLE.map((p) => (
          <li key={p.id} className="rounded-xl border border-border bg-card p-3 flex items-center justify-between">
            <div>
              <p className="font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.relationship[L]}</p>
            </div>
            <a href={`tel:${p.phone}`} className="inline-flex items-center gap-1 text-sm text-primary"><Phone size={14} /> {p.phone}</a>
          </li>
        ))}
      </ul>
      <DemoCareHandoffButton L={L} />
      <DemoEmergencyButton L={L} />
      <DemoWhereIsRosa L={L} />
      <DemoResources L={L} />
    </div>
  );
}

function SummaryTab({ L, setPreview }: { L: "en" | "es"; setPreview: (f: ComingSoonFeature) => void }) {
  // Sort logs ascending by date for trend lines
  const sorted = [...DEMO_LOGS].sort((a, b) => a.date.localeCompare(b.date));
  const moodData = sorted.map((l) => ({
    date: l.date.slice(5),
    mood: l.mood,
    sleep: l.sleep === "well" ? 3 : l.sleep === "okay" ? 2 : 1,
  }));

  // Episodes by time of day
  // Difficult episodes exclude tracked-but-not-distress items (appetite) and the safety red flags (shown on the safety card).
  const isEpisode = (s: { kind?: string }) => !s.kind;
  const tod: Record<string, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  for (const l of DEMO_LOGS) for (const s of l.symptoms.filter(isEpisode)) {
    const k = s.timeOfDay && tod[s.timeOfDay] !== undefined ? s.timeOfDay : "morning";
    tod[k] += 1;
  }
  const todLabels: Record<string, { en: string; es: string }> = {
    morning: { en: "Morning", es: "Mañana" }, afternoon: { en: "Afternoon", es: "Tarde" },
    evening: { en: "Evening", es: "Tarde-noche" }, night: { en: "Night", es: "Noche" },
  };
  const episodeData = Object.entries(tod).map(([k, v]) => ({ name: todLabels[k][L], count: v }));

  // Sleep distribution
  const sleepCounts = DEMO_LOGS.reduce((acc, l) => { acc[l.sleep] = (acc[l.sleep] || 0) + 1; return acc; }, {} as Record<string, number>);
  const sleepData = [
    { name: L === "es" ? "Bien" : "Well", value: sleepCounts.well || 0, color: "#AE4A2A" },
    { name: L === "es" ? "Regular" : "Okay", value: sleepCounts.okay || 0, color: "#A39689" },
    { name: L === "es" ? "Mal" : "Poor", value: sleepCounts.poorly || 0, color: "#5E554E" },
  ];

  // Symptom counts
  const symCounts: Record<string, number> = {};
  for (const l of DEMO_LOGS) for (const s of l.symptoms.filter((x) => x.kind !== "flag")) {
    const n = s.name[L]; symCounts[n] = (symCounts[n] || 0) + 1;
  }
  const symptomData = Object.entries(symCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  const avgMood = (DEMO_LOGS.reduce((n, l) => n + l.mood, 0) / DEMO_LOGS.length).toFixed(1);
  const totalEpisodes = DEMO_LOGS.reduce((n, l) => n + l.symptoms.filter(isEpisode).length, 0);
  const poorSleepNights = sleepCounts.poorly || 0;

  // Plain-language summary inputs (observations only, derived from logged data)
  const dayCount = 12;
  const afternoonEpisodes = tod.afternoon || 0;
  const easedCount = DEMO_LOGS.reduce((n, l) => n + l.symptoms.filter(isEpisode).filter((s) => (s.outcome?.en || "").toLowerCase().includes("music")).length, 0);
  const easedDen = totalEpisodes;
  const summaryEn = `Over the last ${dayCount} days, Rosa logged ${totalEpisodes} difficult ${totalEpisodes === 1 ? "episode" : "episodes"}. Most happened in the afternoon, between 2:30 and 3:30 PM, which lines up with her old 3 PM routine of leaving school. Music and dim light eased the episode ${easedCount} out of ${easedDen} times. She slept poorly on ${poorSleepNights} ${poorSleepNights === 1 ? "night" : "nights"} and her overall mood averaged ${avgMood} out of 5. No falls and no medication changes during this period.`;
  const summaryEs = `En los últimos ${dayCount} días, Rosa registró ${totalEpisodes} ${totalEpisodes === 1 ? "episodio difícil" : "episodios difíciles"}. La mayoría ocurrió por la tarde, entre las 2:30 y las 3:30 PM, lo que coincide con su antigua rutina de salir de la escuela a las 3 PM. La música y la luz tenue aliviaron el episodio ${easedCount} de ${easedDen} veces. Durmió mal ${poorSleepNights} ${poorSleepNights === 1 ? "noche" : "noches"} y su ánimo general promedió ${avgMood} de 5. Sin caídas y sin cambios de medicación en este periodo.`;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold inline-flex items-center gap-2">
              <FileText size={18} /> {L === "es" ? "Resumen médico" : "Physician summary"}
              <InfoDot label={L === "es" ? "Resumen médico" : "Physician summary"}>
                <p>{L === "es"
                  ? "Generado a partir de las observaciones registradas — solo conteos y fechas. Nunca es un diagnóstico."
                  : "Generated from logged observations — counts and dates only. Never a diagnosis."}</p>
              </InfoDot>
            </h2>
            <p className="text-xs text-muted-foreground mt-1">{L === "es" ? "Últimos 12 días · listo para imprimir o compartir" : "Last 12 days · ready to print or share"}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="text-sm rounded-lg border border-border px-3 py-1.5 hover:bg-muted">{L === "es" ? "Imprimir" : "Print"}</button>
            <button onClick={() => setPreview(COMING_SOON.summary)} className="text-sm rounded-lg bg-primary text-primary-foreground px-3 py-1.5">{L === "es" ? "Compartir" : "Share"}</button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Stat label={L === "es" ? "Registros" : "Logs"} value={String(DEMO_LOGS.length)} />
          <Stat label={L === "es" ? "Episodios" : "Episodes"} value={String(totalEpisodes)} />
          <Stat label={L === "es" ? "Ánimo promedio" : "Avg. mood"} value={avgMood} />
          <Stat label={L === "es" ? "Noches mal sueño" : "Poor sleep nights"} value={String(poorSleepNights)} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-semibold">{L === "es" ? "Resumen" : "Summary"}</h3>
        <p className="mt-2 text-sm leading-relaxed text-foreground/90">{L === "es" ? summaryEs : summaryEn}</p>
        <p className="mt-3 text-xs italic text-muted-foreground">{L === "es" ? "Solo observaciones — no es un diagnóstico." : "Observations only — not a diagnosis."}</p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-semibold">{L === "es" ? "Ánimo y sueño en el tiempo" : "Mood & sleep over time"}</h3>
        <p className="text-xs text-muted-foreground">{L === "es" ? "Ánimo 1–5 · Sueño 1=mal, 2=regular, 3=bien" : "Mood 1–5 · Sleep 1=poor, 2=okay, 3=well"}</p>
        <div className="h-56 mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={moodData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6DED5" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <ReferenceLine y={3} stroke="#CFC4B9" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="mood" stroke="#AE4A2A" strokeWidth={2.5} dot={{ r: 3 }} name={L === "es" ? "Ánimo" : "Mood"} />
              <Line type="monotone" dataKey="sleep" stroke="#6F645B" strokeWidth={2} dot={{ r: 3 }} name={L === "es" ? "Sueño" : "Sleep"} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-semibold">{L === "es" ? "Episodios por hora del día" : "Episodes by time of day"}</h3>
          <p className="text-xs text-muted-foreground">{L === "es" ? "La tarde domina — coincide con su rutina de las 3 PM." : "Afternoon dominates — aligns with her 3 PM routine."}</p>
          <div className="h-52 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={episodeData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6DED5" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="count" fill="#AE4A2A" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-semibold">{L === "es" ? "Calidad del sueño" : "Sleep quality"}</h3>
          <p className="text-xs text-muted-foreground">{L === "es" ? "Distribución de las noches registradas." : "Distribution of logged nights."}</p>
          <div className="h-52 mt-3 flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sleepData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={3}>
                  {sleepData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="text-xs space-y-1 pr-2">
              {sleepData.map((d) => (
                <li key={d.name} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} /> {d.name} · {d.value}</li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-semibold">{L === "es" ? "Síntomas registrados" : "Symptoms logged"}</h3>
        <div className="h-52 mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={symptomData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6DED5" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="count" fill="#6F645B" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-muted text-foreground p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide"><Sparkles size={14} /> {L === "es" ? "Notas para el médico" : "Notes for the clinician"}</div>
        <ul className="mt-2 text-sm space-y-1.5 list-disc pl-5">
          <li>{L === "es" ? `${totalEpisodes} episodios en 12 días, concentrados entre 2:30–3:30 PM.` : `${totalEpisodes} episodes over 12 days, concentrated 2:30–3:30 PM.`}</li>
          <li>{L === "es" ? `${poorSleepNights} noches de mal sueño; ánimo promedio ${avgMood}/5.` : `${poorSleepNights} nights of poor sleep; average mood ${avgMood}/5.`}</li>
          <li>{L === "es" ? "Música + luz tenue ha resuelto 6 de 8 episodios." : "Music + dim light has resolved 6 of 8 episodes."}</li>
          <li>{L === "es" ? "Sin caídas. Sin cambios de medicación." : "No falls. No medication changes."}</li>
        </ul>
        <p className="mt-3 text-xs italic opacity-80">{L === "es" ? "Observaciones — no es un diagnóstico." : "Observations — not a diagnosis."}</p>
      </section>
    </div>
  );
}

function SettingsTab({ L }: { L: "en" | "es" }) {
  const es = L === "es";
  const sections: { title: string; items: { label: string; value: string }[] }[] = [
    {
      title: es ? "Quién es ella" : "Who she is",
      items: [
        { label: es ? "Nombre" : "Name", value: `${ROSA.name} (${es ? "prefiere" : "prefers"} "${ROSA.preferredName}")` },
        { label: es ? "Edad" : "Age", value: `${ROSA.age}` },
        { label: es ? "Ciudad natal" : "Hometown", value: "Guadalajara, México" },
        { label: es ? "Idioma" : "Language", value: es ? "Bilingüe — español primero" : "Bilingual — Spanish first" },
        { label: es ? "Fe" : "Faith", value: es ? "Católica" : "Catholic" },
        { label: es ? "Vida" : "Life", value: es ? "Maestra de kínder jubilada (31 años)" : "Retired kindergarten teacher (31 years)" },
      ],
    },
    {
      title: es ? "Historia y rutinas que aún importan" : "Life history & routines that still matter",
      items: [
        { label: "3:00 PM", value: es ? "Salió del trabajo a las 3:00 PM cada día durante 31 años — por eso la tarde la inquieta." : "Left work every day at 3:00 PM for 31 years — this is why afternoons unsettle her." },
        { label: es ? "Familia" : "Family", value: es ? "Crió a sus hijos en esta ciudad; la casa es el centro de su mundo." : "Raised her children in this city; home is the center of her world." },
        { label: es ? "Jardín" : "Garden", value: es ? "Cuidó un jardín de rosas cada primavera durante décadas." : "Tended a rose garden every spring for decades." },
        { label: es ? "Iglesia" : "Church", value: es ? "Misa los domingos — un ancla semanal." : "Sunday mass — a weekly anchor." },
      ],
    },
    {
      title: es ? "Lo que la calma" : "What calms her",
      items: [
        { label: es ? "Música" : "Music", value: "Vicente Fernández, Pedro Infante" },
        { label: es ? "Fotos" : "Photos", value: es ? "Mirar fotos familiares — boda, nietos, jardín" : "Looking at family photos — wedding, grandchildren, garden" },
        { label: es ? "Voz" : "Voice", value: es ? "La voz de su hija María" : "Her daughter María's voice" },
        { label: es ? "Luz" : "Lighting", value: es ? "Luz cálida y tenue al final de la tarde" : "Dim warm lighting in the late afternoon" },
      ],
    },
    {
      title: es ? "Disparadores conocidos" : "Known triggers",
      items: [
        { label: "3:00 PM", value: es ? "Subestimulación a media tarde alrededor de las 3 PM" : "Late-afternoon understimulation around 3 PM" },
        { label: es ? "Atardecer" : "Sundown", value: es ? "Atardecer (sundowning)" : "Sunset (sundowning)" },
        { label: es ? "Prisa" : "Being rushed", value: es ? "Sentirse apurada o presionada" : "Being rushed or hurried" },
        { label: es ? "Ruido" : "Noise", value: es ? "Entornos ruidosos o llenos de gente" : "Loud or crowded environments" },
      ],
    },
    {
      title: es ? "Lo que la app ha aprendido" : "What the app has learned",
      items: [
        { label: es ? "Patrón" : "Pattern", value: es ? "Agitación vespertina ligada a su rutina de las 3 PM — 5 de los últimos 8 episodios." : "Afternoon agitation linked to her 3 PM routine — 5 of the last 8 episodes." },
        { label: es ? "Música" : "Music", value: es ? "La música ha aliviado 6 de 8 momentos de angustia." : "Music has eased 6 of 8 distress moments." },
        { label: es ? "Sueño" : "Sleep", value: es ? "Las caídas de sueño preceden a días más difíciles." : "Sleep dips precede harder days." },
      ],
    },
  ];
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{es ? "Huella personal" : "Patient Fingerprint"}</h2>
        <p className="text-sm text-muted-foreground">
          {es
            ? `Todo lo que Companion Care ha aprendido sobre ${ROSA.preferredName} — quién es, qué la calma y qué la altera. Léelo en dos minutos.`
            : `Everything Companion Care has learned about ${ROSA.preferredName} — who she is, what calms her, what unsettles her. A two-minute read.`}
        </p>
      </div>
      <DemoFamiliarVoiceCard L={L} />

      {sections.map((s) => (
        <section key={s.title} className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">{s.title}</h3>
          <div className="space-y-2 text-sm">
            {s.items.map((it) => (
              <div key={it.label} className="grid grid-cols-[7rem_1fr] gap-3 sm:grid-cols-[9rem_1fr]">
                <span className="text-muted-foreground">{it.label}</span>
                <span className="text-foreground">{it.value}</span>
              </div>
            ))}
          </div>
        </section>
      ))}

      <p className="text-xs text-muted-foreground italic px-1">
        {es
          ? "Este es un perfil de demostración — en la versión completa, esta huella se construye desde la admisión y todo lo registrado con el tiempo."
          : "This is a demo profile — in the full version, this fingerprint is built from intake plus everything logged over time."}
      </p>
      <p className="text-xs text-muted-foreground italic px-1">
        {es ? "Demo — los cambios no se guardan." : "Demo — changes are not saved."}
      </p>
    </div>
  );
}

function ActionTile({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-2xl border border-border bg-card p-4 flex flex-col items-center gap-2 hover:border-primary/40 min-h-[100px]">
      <span className="text-primary [&_svg]:h-6 [&_svg]:w-6">{icon}</span>
      <span className="text-sm font-medium text-center">{label}</span>
    </button>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-muted px-2 py-1 text-xs">{children}</span>;
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3 text-center">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function LiveEntry({ e, L }: { e: DemoEntry; L: "en" | "es" }) {
  const time = new Date(e.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const sourceLabel = e.source === "patient"
    ? (L === "es" ? "Rosa" : "Rosa")
    : (L === "es" ? "Cuidadora" : "Caregiver");
  if (e.kind === "episode") {
    const sym = e.symptom ? e.symptom.replace(/_/g, " ") : (L === "es" ? "Episodio" : "Episode");
    const detail = [e.timeOfDay, e.antecedent && (L === "es" ? `antes: ${e.antecedent.replace(/_/g, " ")}` : `before: ${e.antecedent.replace(/_/g, " ")}`), e.outcome && (L === "es" ? `resultado: ${e.outcome.replace(/_/g, " ")}` : `result: ${e.outcome.replace(/_/g, " ")}`)].filter(Boolean).join(" · ");
    return (
      <div>
        <div className="flex justify-between text-xs text-muted-foreground"><span>{sourceLabel} · {time}</span><span className="capitalize">{sym}</span></div>
        {detail && <p className="mt-1 text-sm capitalize">{detail}</p>}
        {e.intervention && <p className="mt-1 text-sm italic">"{e.intervention}"</p>}
      </div>
    );
  }
  const mood = e.mood ? `${L === "es" ? "Ánimo" : "Mood"} ${e.mood}/5` : "";
  const sleep = e.sleep ? `${L === "es" ? "Sueño" : "Sleep"}: ${e.sleep}` : "";
  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground"><span>{sourceLabel} · {time}</span><span>{[mood, sleep].filter(Boolean).join(" · ")}</span></div>
      {e.symptom && <p className="mt-1 text-sm">{e.symptom}</p>}
      {e.note && <p className="mt-1 text-sm italic">"{e.note}"</p>}
    </div>
  );
}
