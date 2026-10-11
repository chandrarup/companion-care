import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Users, Music as MusicIcon, ChevronLeft, ChevronRight, Play, Pause, Moon, Smile, MessageCircle, Bell, ArrowRight, Check, X, Volume2, NotebookPen, Sparkles, ClipboardList, Stethoscope } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { ROSA, DEMO_PEOPLE } from "@/lib/demo/data";
import { useDemoPhotos } from "@/lib/demo/photos-store";
import { demoTalkReply, demoGreetingAudio } from "@/lib/demo-talk.functions";
import { DEMO_GREETING } from "@/lib/demo/rosa-facts";
import { TalkPanel } from "@/components/TalkPanel";
import { playAudioB64, playAudioUrl, stopCaregiverSpeech, unlockAudio } from "@/lib/caregiver-voice";
import { getActiveDemoVoiceToken, useDemoVoice, withClientTimeout } from "@/lib/demo/demo-voice";
import { useFamiliarVoice, getDemoEmotion, getDemoMood } from "@/lib/demo/familiar-voice";
import { CANNED, pickCanned, STATIC_AUDIO_URL } from "@/lib/demo/rosa-canned";
import { demoSpeak } from "@/lib/demo-voice.functions";
import { PhotoCard } from "@/components/demo/PhotoCard";
import { DemoReminder, DemoShowReminderButton } from "@/components/demo/DemoReminder";
import { DemoAsk } from "@/components/demo/DemoAsk";
import { DemoPatientLogForm } from "@/components/demo/DemoPatientLogForm";
import { DemoEpisodeForm } from "@/components/demo/DemoEpisodeForm";
import { DemoMusicPlayer } from "@/components/demo/DemoMusicPlayer";
import { useDemoEntries } from "@/lib/demo/log-store";
import { DemoComingSoon, type ComingSoonFeature } from "@/components/demo/DemoComingSoon";
import { DemoEmergencyButton } from "@/components/demo/DemoSafety";

export const Route = createFileRoute("/demo/patient")({
  component: DemoPatient,
});

type View = "menu" | "people" | "music" | "selfcare";
type SelfCare = null | "sleep" | "mood" | "bothering" | "reminders";

function DemoPatient() {
  const { t, lang } = useT();
  const L = (lang as "en" | "es") === "es" ? "es" : "en";
  const navigate = useNavigate();
  const [view, setView] = useState<View>("menu");
  const [selfCare, setSelfCare] = useState<SelfCare>(null);
  const [slide, setSlide] = useState(0);
  const photos = useDemoPhotos();
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [switchStep, setSwitchStep] = useState<0 | 1>(0);
  const [switchA1, setSwitchA1] = useState<boolean | null>(null);
  const [talkOpen, setTalkOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreView, setMoreView] = useState<null | "fullLog" | "reminders" | "visitPrep">(null);

  // Escape closes whichever overlay is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSwitchOpen(false); setMoreOpen(false); setLogOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (view !== "menu") return;
    const id = setInterval(() => setSlide((i) => (i + 1) % Math.max(1, photos.length)), 7000);
    return () => clearInterval(id);
  }, [view]);

  const photo = photos[slide % photos.length];

  function ack(key: string) {
    setSavedKey(key);
    setTimeout(() => setSavedKey(null), 1800);
  }

  return (
    <div className="relative">
      <DemoReminder mode="patient" />
      <DemoAsk mode="patient" />

      {view === "menu" && (
        <div className="relative min-h-[calc(100dvh-110px)] overflow-hidden flex flex-col">
          {/* Background photo — the emotional centerpiece */}
          <div className={`absolute inset-0 bg-gradient-to-br ${photo.gradient}`}>
            <img
              key={photo.id}
              src={photo.image}
              alt={photo.caption[L]}
              className="absolute inset-0 h-full w-full object-cover object-top sm:object-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-700"
            />
            {/* Soft scrim only at top and bottom — middle stays clear */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-44 sm:h-56 bg-gradient-to-b from-black/55 via-black/20 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 sm:h-80 bg-gradient-to-t from-black/65 via-black/25 to-transparent" />
          </div>

          {/* Small top utility row: show reminder + switch link */}
          <div className="relative px-4 pt-3 flex justify-between items-center gap-2">
            <DemoShowReminderButton label={L === "es" ? "Mostrar recordatorio" : "Show reminder"} />
            <button
              type="button"
              onClick={() => { setSwitchStep(0); setSwitchA1(null); setSwitchOpen(true); }}
              className="text-xs text-white/85 hover:text-primary-foreground underline-offset-2 hover:underline inline-flex items-center gap-1 rounded-full bg-black/25 px-3.5 py-2.5 min-h-11"
            >
              {t("demo.patient.switchSmall")} <ArrowRight size={12} />
            </button>
          </div>

          {/* Header: caption as a top title, greeting and date split to clear the photo center */}
          <div className="relative px-4 pt-3 sm:px-6">
            {/* Photo caption as a separate top title */}
            <div className="text-center mb-4 sm:mb-6">
              <span className="inline-block text-xs sm:text-sm md:text-base font-light tracking-[0.2em] text-white/90 uppercase drop-shadow-sm px-3 py-1.5 rounded-full bg-black/20">
                {photo.caption[L]}
              </span>
            </div>

            {/* Greeting left, date right */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="rounded-2xl bg-black/30 px-4 sm:px-5 py-3 border border-white/10">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-primary-foreground leading-tight">
                  {t("patient.greeting", { name: ROSA.preferredName })}
                </h1>
              </div>
              <DateTimeDisplay L={L} />
            </div>
          </div>

          {/* Spacer so the photo stays visible in the middle */}
          <div className="relative flex-1" />

          {/* Actions pinned to the bottom — just three primary buttons + one small link */}
          <div className="relative px-4 pb-6 pt-4">
            <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-3xl mx-auto">
              <BigButton icon={<Mic />} label={t("patient.talk")} onClick={() => setTalkOpen(true)} />
              <BigButton icon={<Users />} label={t("patient.people")} onClick={() => setView("people")} />
              <BigButton icon={<MusicIcon />} label={t("patient.music")} onClick={() => setView("music")} />
            </div>

            <div className="mt-4 max-w-3xl mx-auto flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              <button
                type="button"
                onClick={() => setLogOpen(true)}
                className="text-sm sm:text-base text-white/95 inline-flex items-center gap-1.5 rounded-full bg-black/30 hover:bg-black/45 px-4 py-2"
              >
                <NotebookPen size={15} /> {L === "es" ? "Apuntar cómo me siento" : "Note how I feel"}
              </button>
              <button
                type="button"
                onClick={() => { setMoreView(null); setMoreOpen(true); }}
                className="text-sm text-white/85 inline-flex items-center gap-1.5 rounded-full bg-black/25 hover:bg-black/40 px-3.5 py-2.5 min-h-11"
              >
                <Sparkles size={13} /> {L === "es" ? "Más herramientas" : "More tools"}
              </button>
            </div>
          </div>

          {talkOpen && <TalkModal L={L} onClose={() => setTalkOpen(false)} />}
          {logOpen && <DemoPatientLogForm onClose={() => setLogOpen(false)} />}
          {moreOpen && (
            <MoreToolsModal
              L={L}
              view={moreView}
              setView={setMoreView}
              onClose={() => { setMoreOpen(false); setMoreView(null); }}
              openSelfCare={() => { setMoreOpen(false); setMoreView(null); setView("selfcare"); }}
            />
          )}

          {switchOpen && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 px-4" role="dialog" aria-modal="true">
              <div data-compact className="w-full max-w-md rounded-3xl bg-card text-card-foreground border border-border p-6">
                <h3 className="text-xl font-bold">{t("demo.patient.switchConfirm.title")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t("demo.patient.switchConfirm.subtitle")}</p>

                {switchStep === 0 && (
                  <div className="mt-4 space-y-3">
                    <p className="text-base">{t("demo.patient.switchConfirm.q1")}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => { setSwitchA1(false); setSwitchStep(1); }} className="rounded-xl border-2 border-foreground bg-card py-3 text-lg font-semibold">{t("common.no")}</button>
                      <button onClick={() => { setSwitchA1(true); setSwitchStep(1); }} className="rounded-xl bg-primary text-primary-foreground py-3 text-lg font-semibold">{t("common.yes")}</button>
                    </div>
                    <button type="button" onClick={() => setSwitchOpen(false)} className="w-full min-h-11 text-sm text-muted-foreground underline">{t("demo.patient.switchConfirm.cancel")}</button>
                  </div>
                )}
                {switchStep === 1 && (
                  <div className="mt-4 space-y-3">
                    <p className="text-base">{t("demo.patient.switchConfirm.q2")}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setSwitchOpen(false)} className="rounded-xl border-2 border-foreground bg-card py-3 text-lg font-semibold">{t("demo.patient.switchConfirm.cancel")}</button>
                      <button
                        onClick={() => { setSwitchOpen(false); navigate({ to: "/demo/caregiver" }); }}
                        className="rounded-xl bg-primary text-primary-foreground py-3 px-2 text-lg font-semibold inline-flex items-center justify-center gap-2 leading-tight"
                      >
                        <Check size={18} className="shrink-0" /> <span>{t("demo.patient.switchConfirm.continue")}</span>
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">{t("demo.patient.switchNote")}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {view === "people" && <PeopleView L={L} onBack={() => setView("menu")} />}
      {view === "music" && <DemoMusicPlayer L={L} onBack={() => setView("menu")} />}
      {view === "selfcare" && (
        <SelfCareView
          L={L} t={t}
          onBack={() => { setView("menu"); setSelfCare(null); }}
          selected={selfCare} setSelected={setSelfCare}
          ack={ack}
        />
      )}
    </div>
  );
}

function BigButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      type="button"
      onClick={onClick}
      className="rounded-2xl bg-card text-foreground border-2 border-foreground px-3 py-5 sm:py-6 flex flex-col items-center gap-2 font-semibold text-base sm:text-lg min-h-[88px]"
    >
      <span className="text-primary [&_svg]:h-7 [&_svg]:w-7">{icon}</span>
      {label}
    </motion.button>
  );
}

function PeopleView({ L, onBack }: { L: "en" | "es"; onBack: () => void }) {
  const { t } = useT();
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const n = DEMO_PEOPLE.length;
  const person = DEMO_PEOPLE[i % n];
  const canned = CANNED.find((c) => c.id === person.id);
  const go = (d: number) => { stopCaregiverSpeech(); setPlaying(false); setI((x) => (x + d + n) % n); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); stopCaregiverSpeech(); };
  }, []);

  /** Speak the short message: in the visitor's own cloned voice when they made one, else the pre-recorded demo voice. */
  async function hear() {
    if (!canned) return;
    setPlaying(true);
    unlockAudio();
    const token = getActiveDemoVoiceToken();
    try {
      if (token) {
        const r = await withClientTimeout(demoSpeak({ data: { token, text: canned[L].slice(0, 200), emotion: getDemoEmotion() } }), 9000);
        if (r.audio && (await playAudioB64(r.audio))) { setPlaying(false); return; }
      }
    } catch {/* fall through to the recorded voice */}
    try { await playAudioUrl(STATIC_AUDIO_URL(canned.id, L)); } catch {}
    setPlaying(false);
  }

  const txt = L === "es"
    ? { count: `${i + 1} de ${n}`, hear: `Escuchar a ${person.name}`, prev: "Anterior", next: "Siguiente", hearing: "Reproduciendo…" }
    : { count: `${i + 1} of ${n}`, hear: `Hear from ${person.name}`, prev: "Previous", next: "Next", hearing: "Playing…" };

  return (
    <div className="px-4 py-4 sm:py-8 mx-auto w-full max-w-5xl">
      <BackBar onBack={onBack} label="" />
      <div className="grid md:grid-cols-2 gap-6 md:gap-10 items-center">
        <div className="relative aspect-[4/3] sm:aspect-square max-h-[38dvh] sm:max-h-[62dvh] w-full mx-auto overflow-hidden rounded-3xl border-2 border-border bg-muted">
          <img
            key={person.id}
            src={person.portrait}
            alt={person.name}
            width={1024}
            height={1024}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
        <div className="flex flex-col gap-5 text-center md:text-left">
          <div>
            <p className="metric-label">{t("patient.people")} · {txt.count}</p>
            <h2 className="mt-2 text-5xl sm:text-6xl font-bold leading-tight">{person.name}</h2>
            <p className="mt-1 text-2xl sm:text-3xl text-muted-foreground">{person.relationship[L]}</p>
          </div>
          {canned && (
            <button
              type="button"
              onClick={hear}
              disabled={playing}
              className="inline-flex items-center justify-center gap-3 rounded-2xl bg-primary text-primary-foreground px-6 min-h-16 text-xl font-semibold disabled:opacity-70"
            >
              <Volume2 size={26} /> {playing ? txt.hearing : txt.hear}
            </button>
          )}
          <div className="flex items-center justify-between gap-3 pt-1">
            <NavBtn icon={<ChevronLeft />} label={txt.prev} onClick={() => go(-1)} />
            <div className="flex gap-2" aria-hidden>
              {DEMO_PEOPLE.map((p, k) => (
                <span key={p.id} className={"h-3 w-3 rounded-full border-2 border-foreground " + (k === i ? "bg-foreground" : "bg-transparent")} />
              ))}
            </div>
            <NavBtn icon={<ChevronRight />} label={txt.next} onClick={() => go(1)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function NavBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-2 rounded-2xl border-2 border-foreground bg-card px-5 min-h-14 text-lg font-semibold">
      {icon}{label}
    </button>
  );
}

function BackBar({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 rounded-xl border-2 border-foreground bg-card px-4 min-h-12 text-base font-semibold">← {useT().lang === "es" ? "Atrás" : "Back"}</button>
      <span className="metric-label">{label}</span>
      <span />
    </div>
  );
}

function SelfCareView({ L, t, onBack, selected, setSelected, ack }: { L: "en" | "es"; t: (k: string, v?: any) => string; onBack: () => void; selected: SelfCare; setSelected: (s: SelfCare) => void; ack: (k: string) => void }) {
  const [bothering, setBothering] = useState("");
  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <BackBar onBack={onBack} label={t("demo.patient.selfCare")} />
      {!selected && (
        <div className="grid grid-cols-2 gap-3">
          <Card onClick={() => setSelected("sleep")} icon={<Moon />} label={t("self.sleep")} />
          <Card onClick={() => setSelected("mood")} icon={<Smile />} label={t("self.mood")} />
          <Card onClick={() => setSelected("bothering")} icon={<MessageCircle />} label={t("self.bothering")} />
          <Card onClick={() => setSelected("reminders")} icon={<Bell />} label={t("self.reminders")} />
        </div>
      )}

      {selected === "sleep" && (
        <SelfChoice prompt={t("self.sleepPrompt")} options={[t("self.well"), t("self.okay"), t("self.poorly")]} onPick={() => { ack("sleep"); setSelected(null); }} />
      )}
      {selected === "mood" && (
        <SelfChoice prompt={t("self.moodPrompt")} options={[t("self.good"), t("self.okay"), t("self.notGreat")]} onPick={() => { ack("mood"); setSelected(null); }} />
      )}
      {selected === "bothering" && (
        <div className="space-y-3">
          <p className="text-xl">{t("self.botheringPrompt")}</p>
          <textarea value={bothering} onChange={(e) => setBothering(e.target.value)} placeholder={t("self.botheringPlaceholder")} className="w-full rounded-xl border border-input bg-background p-3 text-lg min-h-[140px]" />
          <button onClick={() => { ack("bothering"); setBothering(""); setSelected(null); }} className="w-full rounded-2xl bg-primary text-primary-foreground py-4 text-lg font-medium">{t("self.save")}</button>
        </div>
      )}
      {selected === "reminders" && (
        <ul className="space-y-3">
          {[{ time: "8:00 AM", label: L === "es" ? "Desayuno y pastilla matutina" : "Breakfast and morning pill" },
            { time: "2:45 PM", label: L === "es" ? "Música — Vicente Fernández" : "Music — Vicente Fernández" },
            { time: "8:30 PM", label: L === "es" ? "Hora tranquila antes de dormir" : "Quiet time before bed" }].map((r, i) => (
            <li key={i} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-4">
              <span className="text-2xl font-semibold w-24">{r.time}</span>
              <span className="text-lg">{r.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Card({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} type="button" className="rounded-2xl border border-border bg-card p-5 flex flex-col items-center gap-2 hover:border-primary/40 min-h-[120px]">
      <span className="text-primary [&_svg]:h-8 [&_svg]:w-8">{icon}</span>
      <span className="text-lg font-semibold text-center">{label}</span>
    </button>
  );
}

function SelfChoice({ prompt, options, onPick }: { prompt: string; options: string[]; onPick: () => void }) {
  return (
    <div className="space-y-3">
      <p className="text-xl">{prompt}</p>
      <div className="grid gap-3">
        {options.map((o, i) => (
          <button key={i} onClick={onPick} className="rounded-2xl border border-border bg-card py-4 text-lg font-medium hover:border-primary/40">{o}</button>
        ))}
      </div>
    </div>
  );
}


function TalkModal({ L, onClose }: { L: "en" | "es"; onClose: () => void }) {
  const mine = useDemoVoice();
  const { enabled } = useFamiliarVoice();
  const usingMine = !!mine.token && enabled;
  return (
    <TalkPanel
      L={L}
      voiceLabel={usingMine ? (L === "es" ? `Tu voz${mine.name ? ` · ${mine.name}` : ""}` : `Your voice${mine.name ? ` · ${mine.name}` : ""}`) : (L === "es" ? "Voz de demostración" : "Demo voice")}
      greeting={DEMO_GREETING[L]}
      getGreetingAudio={async () => {
        try {
          const r = await withClientTimeout(demoGreetingAudio({ data: { lang: L, voiceToken: getActiveDemoVoiceToken() } }), 9000);
          if (r.audio) return { audio: r.audio };
        } catch {/*fall through to the pre-generated file*/}
        return { audioUrl: STATIC_AUDIO_URL("greeting", L) };
      }}
      getReply={async (userText, history) => {
        try {
          const r = await withClientTimeout(demoTalkReply({ data: { lang: L, history, userText, voiceToken: getActiveDemoVoiceToken(), emotion: getDemoMood() } }), 15000);
          return { text: r.reply, audio: r.audio, audioUrl: r.cannedId ? STATIC_AUDIO_URL(r.cannedId, L) : undefined };
        } catch {
          // Server unreachable or too slow: stay warm and on-topic with a pre-written reply + pre-generated audio.
          const c = pickCanned(L, userText);
          return { text: c.text, audio: null, audioUrl: STATIC_AUDIO_URL(c.id, L) };
        }
      }}
      speak={async (text, audio, audioUrl) => {
        // The chosen voice must be the voice that is heard: if its audio exists but the browser blocks it, report "blocked"
        // (the panel then shows "Tap to hear") instead of silently swapping in a different voice.
        if (audio) return playAudioB64(audio);
        if (audioUrl && (await playAudioUrl(audioUrl))) return true;
        try {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(text);
          u.lang = L === "es" ? "es-ES" : "en-US";
          u.rate = 0.92;
          window.speechSynthesis.speak(u);
          return true;
        } catch {
          return false;
        }
      }}
      onClose={() => { stopCaregiverSpeech(); onClose(); }}
    />
  );
}

function DateTimeDisplay({ L }: { L: "en" | "es" }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const locale = L === "es" ? "es-ES" : "en-US";
  const dateStr = now.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  return (
    <div className="rounded-2xl bg-black/30 px-4 sm:px-5 py-3 border border-white/10 text-right flex flex-col gap-0">
      <span className="text-lg sm:text-xl font-medium leading-tight first-letter:uppercase text-primary-foreground" suppressHydrationWarning>{dateStr}</span>
      <span className="text-base sm:text-lg text-white/80" suppressHydrationWarning>{timeStr}</span>
    </div>
  );
}

function MoreToolsModal({
  L, view, setView, onClose, openSelfCare,
}: {
  L: "en" | "es";
  view: null | "fullLog" | "reminders" | "visitPrep";
  setView: (v: null | "fullLog" | "reminders" | "visitPrep") => void;
  onClose: () => void;
  openSelfCare: () => void;
}) {
  if (view === "fullLog") {
    return <DemoEpisodeForm source="patient" onClose={onClose} />;
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-card text-card-foreground border border-border p-5 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {view === "reminders"
              ? (L === "es" ? "Mis recordatorios" : "My reminders")
              : view === "visitPrep"
                ? (L === "es" ? "Para mi cita médica" : "For my doctor visit")
                : (L === "es" ? "Más herramientas" : "More tools")}
          </h3>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded bg-muted"><X size={18} /></button>
        </div>

        {view === null && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              {L === "es"
                ? "Cosas que puedes hacer tú misma."
                : "Things you can do on your own."}
            </p>
            <ToolRow
              icon={<Smile size={20} />}
              title={L === "es" ? "¿Cómo estoy hoy?" : "How am I today"}
              desc={L === "es" ? "Sueño, ánimo, lo que me molesta." : "Sleep, mood, what's bothering me."}
              onClick={openSelfCare}
            />
            <ToolRow
              icon={<ClipboardList size={20} />}
              title={L === "es" ? "Apuntar un episodio (completo)" : "Add a full log entry"}
              desc={L === "es" ? "Paso a paso, como lo hace tu cuidador." : "Step-by-step, the way your caregiver does it."}
              onClick={() => setView("fullLog")}
            />
            <ToolRow
              icon={<Bell size={20} />}
              title={L === "es" ? "Ver mis recordatorios" : "View my reminders"}
              desc={L === "es" ? "Lo que viene hoy." : "What's coming up today."}
              onClick={() => setView("reminders")}
            />
            <ToolRow
              icon={<Stethoscope size={20} />}
              title={L === "es" ? "Prepararme para el médico" : "Prepare for doctor visit"}
              desc={L === "es" ? "Lo que debo llevar y contar." : "What to bring and share."}
              onClick={() => setView("visitPrep")}
            />
            <div className="pt-2 flex justify-center">
              <DemoEmergencyButton L={L} variant="pill" />
            </div>
          </div>
        )}

        {view === "reminders" && (
          <div className="mt-4 space-y-3">
            <button onClick={() => setView(null)} className="text-sm underline">← {L === "es" ? "Atrás" : "Back"}</button>
            <ul className="space-y-2">
              {[
                { time: "8:00 AM", label: L === "es" ? "Desayuno y pastilla matutina" : "Breakfast and morning pill" },
                { time: "12:30 PM", label: L === "es" ? "Agua y comida ligera" : "Water and a light meal" },
                { time: "2:45 PM", label: L === "es" ? "Música — Vicente Fernández" : "Music — Vicente Fernández" },
                { time: "6:00 PM", label: L === "es" ? "Pastilla de la tarde" : "Evening pill" },
                { time: "8:30 PM", label: L === "es" ? "Hora tranquila antes de dormir" : "Quiet time before bed" },
              ].map((r, i) => (
                <li key={i} className="rounded-xl border border-border bg-muted p-3 flex items-center gap-3">
                  <span className="text-base font-semibold w-20 text-primary">{r.time}</span>
                  <span className="text-base">{r.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {view === "visitPrep" && <VisitPrep L={L} onBack={() => setView(null)} />}
      </div>
    </div>
  );
}

function ToolRow({ icon, title, desc, onClick }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border hover:border-primary/40 bg-muted p-3 flex items-start gap-3"
    >
      <span className="text-primary mt-0.5">{icon}</span>
      <span className="flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted-foreground">{desc}</span>
      </span>
      <ArrowRight size={16} className="text-muted-foreground mt-1" />
    </button>
  );
}

function VisitPrep({ L, onBack }: { L: "en" | "es"; onBack: () => void }) {
  const entries = useDemoEntries();
  const dayMs = 7 * 24 * 60 * 60 * 1000;
  const recent = entries.filter((e) => Date.now() - e.createdAt < dayMs);
  const episodes = recent.filter((e) => e.kind === "episode");
  const notes = recent.filter((e) => e.kind === "note");

  return (
    <div className="mt-4 space-y-4">
      <button onClick={onBack} className="text-sm underline">← {L === "es" ? "Atrás" : "Back"}</button>

      <div className="rounded-xl bg-muted border border-border p-3 text-sm text-foreground">
        {L === "es"
          ? "Lleva esto a tu cita. Companion Care lo preparó por ti."
          : "Bring this to your appointment. Companion Care put it together for you."}
      </div>

      <section>
        <h4 className="font-semibold mb-2">{L === "es" ? "Lo que he registrado esta semana" : "What I've logged this week"}</h4>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {L === "es" ? "Aún no hay registros nuevos esta semana." : "No new entries yet this week."}
          </p>
        ) : (
          <ul className="space-y-2">
            {episodes.map((e) => (
              <li key={e.id} className="rounded-lg border border-border p-2 text-sm">
                <span className="font-medium">{e.symptom}</span>
                <span className="text-muted-foreground"> · {e.timeOfDay} · {L === "es" ? "ayudó:" : "helped:"} {e.intervention} → {e.outcome}</span>
              </li>
            ))}
            {notes.map((n) => (
              <li key={n.id} className="rounded-lg border border-border p-2 text-sm">
                <span className="font-medium">{L === "es" ? "Nota" : "Note"}:</span>{" "}
                <span className="text-muted-foreground">{n.note || (n.symptom ?? "")}</span>
                {n.sleep && <span className="text-muted-foreground"> · {L === "es" ? "dormí" : "slept"} {n.sleep}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 className="font-semibold mb-2">{L === "es" ? "Preguntas para el médico" : "Questions for the doctor"}</h4>
        <ul className="list-disc pl-5 text-sm space-y-1 text-muted-foreground">
          <li>{L === "es" ? "¿Es normal que me confunda por las tardes?" : "Is it normal that I get confused in the afternoons?"}</li>
          <li>{L === "es" ? "¿Mis pastillas están bien como están?" : "Are my pills okay the way they are?"}</li>
          <li>{L === "es" ? "¿Qué puedo hacer para dormir mejor?" : "What can I do to sleep better?"}</li>
        </ul>
      </section>

      <section>
        <h4 className="font-semibold mb-2">{L === "es" ? "Mis medicamentos" : "My medications"}</h4>
        <ul className="text-sm space-y-1 text-muted-foreground">
          <li>Donepezil 10 mg — 1× {L === "es" ? "por la noche" : "at night"}</li>
          <li>Memantine 10 mg — 2× {L === "es" ? "al día" : "daily"}</li>
          <li>Lisinopril 20 mg — 1× {L === "es" ? "por la mañana" : "in the morning"}</li>
        </ul>
      </section>
    </div>
  );
}
