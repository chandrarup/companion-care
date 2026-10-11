import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2, X } from "lucide-react";
import { unlockAudio } from "@/lib/caregiver-voice";

export type TalkTurn = { role: "user" | "assistant"; content: string };
type Turn = TalkTurn & { audio?: string | null; audioUrl?: string; blocked?: boolean };

/** Voice-first conversation panel. The caller supplies how replies are produced and spoken. */
export function TalkPanel({
  L,
  greeting,
  getReply,
  speak: speakOut,
  getGreetingAudio,
  voiceLabel,
  onClose,
}: {
  L: "en" | "es";
  greeting: string;
  getReply: (userText: string, history: TalkTurn[]) => Promise<{ text: string; audio?: string | null; audioUrl?: string }>;
  /** Resolves true if the reply was spoken aloud; false if the browser blocked the audio. */
  speak: (text: string, audio?: string | null, audioUrl?: string) => Promise<boolean> | boolean | void;
  voiceLabel?: string;
  getGreetingAudio?: () => Promise<{ audio?: string | null; audioUrl?: string } | null>;
  onClose: () => void;
}) {

  const [turns, setTurns] = useState<Turn[]>([{ role: "assistant", content: greeting }]);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [thinking, setThinking] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [draft, setDraft] = useState("");
  const recRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const SR =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;
  const supported = !!SR;

  const speak = speakOut;

  // Greet aloud on open (after a small delay so dialog animation is in).
  useEffect(() => {
    unlockAudio();
    const id = setTimeout(async () => {
      let g: { audio?: string | null; audioUrl?: string } | null = null;
      try { g = (await getGreetingAudio?.()) ?? null; } catch {/*noop*/}
      setTurns((t) => t.map((x, i) => (i === 0 ? { ...x, audio: g?.audio, audioUrl: g?.audioUrl } : x)));
      const ok = await speak(greeting, g?.audio, g?.audioUrl);
      if (ok === false && (g?.audio || g?.audioUrl)) setTurns((t) => t.map((x, i) => (i === 0 ? { ...x, blocked: true } : x)));
    }, 350);
    return () => clearTimeout(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape closes the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Auto-scroll on new turn
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, thinking, interim]);

  async function sendUserText(userText: string) {
    const trimmed = userText.trim();
    if (!trimmed) return;
    unlockAudio(); // sending is a tap/keypress: lets the reply's audio start later
    const history = turns.slice(-12).map(({ role, content }) => ({ role, content })); // text only, keep it small
    const nextTurns = [...turns, { role: "user" as const, content: trimmed }];
    setTurns(nextTurns);
    setInterim("");
    setThinking(true);
    try {
      const got = await getReply(trimmed, history);
      const reply = got.text;
      const idx = nextTurns.length;
      setTurns((t) => [...t, { role: "assistant", content: reply, audio: got.audio, audioUrl: got.audioUrl }]);
      const ok = await speak(reply, got.audio, got.audioUrl);
      if (ok === false && (got.audio || got.audioUrl)) setTurns((t) => t.map((x, i) => (i === idx ? { ...x, blocked: true } : x)));
    } catch {
      const fb = L === "es"
        ? "Qué bonito escucharte. Cuéntame más, querida."
        : "It's so nice to hear you. Tell me more, dear.";
      setTurns((t) => [...t, { role: "assistant", content: fb }]);
      speak(fb);
    } finally {
      setThinking(false);
    }
  }

  function startListening() {
    unlockAudio();
    if (!supported) { setTextMode(true); return; }
    try { window.speechSynthesis?.cancel(); } catch {/*noop*/}
    const rec = new SR();
    rec.lang = L === "es" ? "es-ES" : "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e: any) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setInterim((finalText + " " + interimText).trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      const q = finalText.trim();
      if (q) void sendUserText(q);
    };
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  }

  function stopListening() {
    try { recRef.current?.stop(); } catch {/*noop*/}
    setListening(false);
  }

  useEffect(() => {
    return () => {
      try { recRef.current?.stop(); } catch {/*noop*/}
      try { window.speechSynthesis?.cancel(); } catch {/*noop*/}
    };
  }, []);

  const tapLabel = listening
    ? (L === "es" ? "Escuchando…" : "Listening…")
    : (L === "es" ? "Toca para hablar" : "Tap to talk");

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" role="dialog" aria-modal="true">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {L === "es" ? "Conversación con Companion Care" : "Conversation with Companion Care"}
          {voiceLabel && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-tint text-tint-foreground px-2 py-0.5 text-xs font-medium"><Volume2 size={12} /> {voiceLabel}</span>}
        </span>
        <button
          onClick={() => { stopListening(); try { window.speechSynthesis?.cancel(); } catch {/*noop*/} onClose(); }}
          aria-label={L === "es" ? "Cerrar" : "Close"}
          className="p-2 rounded-full hover:bg-muted text-muted-foreground"
        >
          <X size={22} />
        </button>
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 pb-4 space-y-4 max-w-2xl w-full mx-auto">
        {turns.map((t, i) => (
          <div key={i} className={t.role === "assistant" ? "" : "flex justify-end"}>
            {t.role === "assistant" ? (
              <div className="rounded-3xl bg-white/85 px-5 py-4 max-w-[90%]">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-primary mb-1 inline-flex items-center gap-1">
                  <Volume2 size={12} /> Companion Care
                </p>
                <p className="text-2xl leading-relaxed text-foreground">{t.content}</p>
                <button
                  type="button"
                  onClick={async () => {
                    unlockAudio();
                    const ok = await speak(t.content, t.audio, t.audioUrl);
                    if (ok !== false) setTurns((all) => all.map((x, j) => (j === i ? { ...x, blocked: false } : x)));
                  }}
                  className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 min-h-11 text-sm font-medium ${t.blocked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  <Volume2 size={16} /> {t.blocked ? (L === "es" ? "Toca para escuchar" : "Tap to hear") : (L === "es" ? "Escuchar de nuevo" : "Hear again")}
                </button>
              </div>
            ) : (
              <div className="rounded-3xl bg-primary text-primary-foreground px-5 py-3 max-w-[85%]">
                <p className="text-xl leading-relaxed">{t.content}</p>
              </div>
            )}
          </div>
        ))}
        {interim && listening && (
          <div className="flex justify-end">
            <div className="rounded-3xl bg-tint text-tint-foreground px-5 py-3 max-w-[85%] italic">
              <p className="text-xl">{interim}…</p>
            </div>
          </div>
        )}
        {thinking && (
          <div>
            <div className="rounded-3xl bg-white/70 px-5 py-3 inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary animate-bounce" />
              <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.15s" }} />
              <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.3s" }} />
            </div>
          </div>
        )}
      </div>

      {/* Mic / input */}
      <div className="px-4 pb-6 pt-2 bg-white/40">
        {!textMode && (
          <div className="flex flex-col items-center gap-2 max-w-2xl mx-auto">
            <button
              type="button"
              onClick={listening ? stopListening : startListening}
              disabled={thinking}
              className={`h-24 w-24 rounded-full inline-flex items-center justify-center transition ${
                listening
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-primary text-primary-foreground disabled:opacity-50"
              }`}
              aria-pressed={listening}
              aria-label={tapLabel}
            >
              {listening ? <MicOff size={40} /> : <Mic size={40} />}
            </button>
            <p className="text-base text-muted-foreground">{tapLabel}</p>
            {supported && (
              <button
                onClick={() => setTextMode(true)}
                className="text-sm text-muted-foreground underline min-h-11 px-3"
              >
                {L === "es" ? "Escribir en su lugar" : "Type instead"}
              </button>
            )}
          </div>
        )}
        {textMode && (
          <form
            onSubmit={(e) => { e.preventDefault(); const v = draft; setDraft(""); void sendUserText(v); }}
            className="flex gap-2 max-w-2xl mx-auto"
          >
            <input
              autoFocus
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={L === "es" ? "Escribe lo que quieras decir…" : "Type what you'd like to say…"}
              className="flex-1 min-w-0 rounded-2xl border border-border bg-card px-3 py-3 text-base sm:text-lg"
            />
            <button
              type="submit"
              disabled={!draft.trim() || thinking}
              className="shrink-0 rounded-2xl bg-primary text-primary-foreground px-4 sm:px-5 font-semibold disabled:opacity-50"
            >
              {L === "es" ? "Enviar" : "Send"}
            </button>
            {supported && (
              <button
                type="button"
                onClick={() => setTextMode(false)}
                aria-label={L === "es" ? "Usar micrófono" : "Use mic"}
                className="shrink-0 rounded-2xl border border-border px-3"
              >
                <Mic size={20} />
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

