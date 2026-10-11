import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, X, Send, Play, ExternalLink, Phone, Mic, MicOff } from "lucide-react";
import { askCanned, type AskResponse } from "@/lib/demo/data";
import { useT } from "@/i18n/I18nProvider";

type Msg = { role: "user" | "assistant"; text?: string; response?: AskResponse };

const SUGGESTIONS_CAREGIVER: { en: string; es: string }[] = [
  { en: "Why does she get upset in the afternoon?", es: "¿Por qué se molesta por la tarde?" },
  { en: "What helps when she won't calm down?", es: "¿Qué ayuda cuando no se calma?" },
  { en: "She didn't sleep well — what can I do?", es: "No durmió bien — ¿qué puedo hacer?" },
  { en: "What should I tell the doctor?", es: "¿Qué debo decirle al médico?" },
  { en: "How do I respond to repeated questions?", es: "¿Cómo respondo a preguntas repetidas?" },
  { en: "She's not eating much — what should I do?", es: "No come mucho — ¿qué hago?" },
  { en: "What if she wanders off?", es: "¿Qué hago si se va sola?" },
  { en: "I'm exhausted — how do I cope?", es: "Estoy agotada — ¿cómo lo manejo?" },
  { en: "What legal things should we set up?", es: "¿Qué temas legales debemos preparar?" },
  { en: "What exercise is safe for her?", es: "¿Qué ejercicio es seguro para ella?" },
  { en: "What are the stages of Alzheimer's?", es: "¿Cuáles son las etapas del Alzheimer?" },
];
const SUGGESTIONS_PATIENT: { en: string; es: string }[] = [
  { en: "Tell me about my music", es: "Cuéntame de mi música" },
  { en: "What was my work?", es: "¿Cuál era mi trabajo?" },
  { en: "Who is María?", es: "¿Quién es María?" },
  { en: "What day is it today?", es: "¿Qué día es hoy?" },
  { en: "Tell me about my wedding", es: "Cuéntame de mi boda" },
  { en: "Who are my grandchildren?", es: "¿Quiénes son mis nietos?" },
  { en: "Sing me something", es: "Cántame algo" },
];
const SUGGESTIONS_PHYSICIAN: { en: string; es: string }[] = [
  { en: "What's changed since last visit?", es: "¿Qué ha cambiado desde la última visita?" },
  { en: "How often is the agitation happening?", es: "¿Con qué frecuencia ocurre la agitación?" },
  { en: "What's been helping?", es: "¿Qué le está ayudando?" },
  { en: "What does her sleep look like?", es: "¿Cómo está su sueño?" },
  { en: "Any safety events?", es: "¿Algún evento de seguridad?" },
  { en: "What should I ask the caregiver?", es: "¿Qué debo preguntarle a la cuidadora?" },
];

export function DemoAsk({ mode, context }: { mode: "patient" | "caregiver"; context?: "patient" | "caregiver" | "physician" }) {
  const { t, lang } = useT();
  const L = (lang as "en" | "es") === "es" ? "es" : "en";
  const ctx: "patient" | "caregiver" | "physician" = context ?? mode;
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceErr, setVoiceErr] = useState<string | null>(null);
  const [sugCursor, setSugCursor] = useState(0);
  const recognitionRef = useRef<any>(null);

  const SpeechRecognition =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;
  const voiceSupported = !!SpeechRecognition;

  useEffect(() => {
    return () => { try { recognitionRef.current?.stop?.(); } catch {} };
  }, []);

  const pool = useMemo(() => {
    if (ctx === "physician") return SUGGESTIONS_PHYSICIAN;
    if (ctx === "patient") return SUGGESTIONS_PATIENT;
    return SUGGESTIONS_CAREGIVER;
  }, [ctx]);

  // Rotating window of 3 suggestions, refreshed after every assistant reply.
  const visibleSuggestions = useMemo(() => {
    const out: { en: string; es: string }[] = [];
    for (let i = 0; i < Math.min(3, pool.length); i++) {
      out.push(pool[(sugCursor + i) % pool.length]);
    }
    return out;
  }, [pool, sugCursor]);

  function send(q: string) {
    const text = q.trim();
    if (!text) return;
    const response = askCanned(text, ctx);
    setMsgs((m) => [...m, { role: "user", text }, { role: "assistant", response }]);
    setInput("");
    setSugCursor((c) => c + 3);
  }

  function toggleVoice() {
    setVoiceErr(null);
    if (!voiceSupported) { setVoiceErr(t("demo.ask.micUnsupported")); return; }
    if (listening) { try { recognitionRef.current?.stop(); } catch {} return; }
    const rec = new SpeechRecognition();
    rec.lang = L === "es" ? "es-ES" : "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setInput((finalText + interim).trim());
    };
    rec.onerror = () => { setListening(false); };
    rec.onend = () => {
      setListening(false);
      const q = finalText.trim();
      if (q) send(q);
    };
    recognitionRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ask-fab fixed right-5 z-30 h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 transition"
        aria-label={t("demo.ask.open")}
      >
        <MessageCircle size={26} />
      </button>

      {open && (
        <div className="fixed inset-0 z-40 sm:inset-auto sm:bottom-24 sm:right-5 sm:w-[380px] sm:max-h-[70vh] sm:rounded-2xl bg-background border border-border flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <p className="font-semibold">{t("demo.ask.title")}</p>
              <p className="text-xs text-muted-foreground">{mode === "patient" ? t("demo.ask.patientMode") : t("demo.ask.caregiverMode")}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="p-1 rounded hover:bg-muted"><X size={18} /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                {m.role === "user" ? (
                  <div className="rounded-2xl bg-primary text-primary-foreground px-3 py-2 max-w-[85%] text-sm">{m.text}</div>
                ) : (
                  <AssistantBubble r={m.response!} L={L} t={t} />
                )}
              </div>
            ))}

            {/* Always offer fresh suggestions after every reply — never runs out. */}
            <div className="space-y-2 pt-1">
              <p className="text-xs text-muted-foreground">
                {msgs.length === 0 ? t("demo.ask.tryAsking") : (L === "es" ? "Sigue preguntando:" : "Keep asking:")}
              </p>
              {visibleSuggestions.map((s, i) => (
                <button
                  key={`${sugCursor}-${i}`}
                  type="button"
                  onClick={() => send(s[L])}
                  className="block w-full text-left text-sm rounded-lg border border-border bg-muted/40 px-3 py-2 hover:bg-muted"
                >
                  {s[L]}
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="border-t border-border p-3 flex flex-col gap-2"
          >
            <div className="flex gap-2">
              <button
                type="button"
                onClick={toggleVoice}
                aria-label={listening ? t("demo.ask.micStop") : t("demo.ask.micStart")}
                aria-pressed={listening}
                className={`shrink-0 rounded-lg px-3 py-2 border ${listening ? "bg-destructive text-destructive-foreground border-destructive" : "bg-background border-input hover:bg-muted"}`}
                title={voiceSupported ? (listening ? t("demo.ask.micStop") : t("demo.ask.micStart")) : t("demo.ask.micUnsupported")}
              >
                {listening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={listening ? t("demo.ask.micListening") : t("demo.ask.placeholder")}
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button type="submit" className="rounded-lg bg-primary text-primary-foreground px-3 py-2" aria-label="Send"><Send size={16} /></button>
            </div>
            {voiceErr && <p className="text-xs text-muted-foreground">{voiceErr}</p>}
          </form>
        </div>
      )}
    </>
  );
}

function AssistantBubble({ r, L, t }: { r: AskResponse; L: "en" | "es"; t: (k: string) => string }) {
  const tone =
    r.kind === "emergency" ? "border-destructive bg-card text-foreground" :
    r.kind === "guardrail" ? "border-border bg-muted text-foreground" :
    r.kind === "personalized" ? "border-border bg-muted text-foreground" :
    r.kind === "educational" ? "border-border bg-muted text-foreground" :
    r.kind === "grounded" ? "border-border bg-muted text-foreground" :
    "border-border bg-muted/40";

  const tag = t(`demo.ask.tag.${r.kind}`);

  return (
    <div className={`rounded-2xl border px-3 py-2 max-w-[90%] text-sm ${tone}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70 mb-1">{tag}</p>
      <p className="whitespace-pre-wrap">{r.text[L]}</p>
      {r.video?.youtubeId && (
        <div className="mt-2 rounded-lg overflow-hidden border border-current/20 bg-black/5">
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube.com/embed/${r.video.youtubeId}`}
              title={r.video.label[L]}
              frameBorder={0}
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <p className="px-2 py-1 text-[11px] opacity-80">{r.video.label[L]}</p>
        </div>
      )}
      {r.video && !r.video.youtubeId && (
        <a href={r.video.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium underline">
          <Play size={12} /> {r.video.label[L]}
        </a>
      )}
      {r.source && (
        <a href={r.source.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium underline">
          <ExternalLink size={12} /> {r.source.label}
        </a>
      )}
      {r.sources && r.sources.length > 0 && (
        <div className="mt-2 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{L === "es" ? "Fuentes" : "Sources"}</p>
          {r.sources.map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-medium underline">
              <ExternalLink size={12} /> {s.label}
            </a>
          ))}
        </div>
      )}
      {r.actions && r.actions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {r.actions.map((a, i) => (
            <a key={i} href={a.phone ? `tel:${a.phone}` : "#"} className="inline-flex items-center gap-1 rounded-md bg-white/70 border border-current/30 px-2 py-1 text-xs font-medium">
              <Phone size={12} /> {a.label[L]}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
