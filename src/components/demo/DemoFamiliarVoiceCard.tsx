import { useEffect, useRef, useState } from "react";
import { Mic, Square, Play, Trash2, Volume2, Check, Upload } from "lucide-react";
import { useFamiliarVoice, stopFamiliarVoice } from "@/lib/demo/familiar-voice";
import { EmotionPicker } from "@/components/EmotionPicker";
import { useDemoVoice, withClientTimeout } from "@/lib/demo/demo-voice";
import { cloneDemoVoice, demoSpeak, removeDemoVoice } from "@/lib/demo-voice.functions";
import { playAudioB64, stopCaregiverSpeech } from "@/lib/caregiver-voice";

type Lang = "en" | "es";
type Clip = { id: string; blob: Blob; url: string; seconds: number; name: string };

const T = {
  title: { en: "Clone your voice", es: "Clona tu voz" },
  sub: {
    en: "Record yourself once. Rosa then hears her reminders — and the replies in Talk — in your voice, powered by ElevenLabs.",
    es: "Grábate una vez. Rosa escuchará sus recordatorios — y las respuestas en Hablar — con tu voz, con tecnología de ElevenLabs.",
  },
  active: { en: "Your cloned voice is active", es: "Tu voz clonada está activa" },
  on: { en: "Use my voice: On", es: "Usar mi voz: Sí" },
  off: { en: "Use my voice: Off", es: "Usar mi voz: No" },
  emotion: { en: "How the voice sounds", es: "Cómo suena la voz" },
  nameLabel: { en: "Your name", es: "Tu nombre" },
  script: {
    en: "Read this aloud, warmly (about 30–60 seconds): “Good morning, Rosa. It's a beautiful day. Let's have some tea and look at our photos together. Remember the garden in the spring? The roses are blooming now. You are safe, you are loved, and I am right here with you whenever you need me.”",
    es: "Lee esto en voz alta, con calidez (unos 30–60 segundos): “Buenos días, Rosa. Es un día hermoso. Vamos a tomar un té y mirar nuestras fotos juntas. ¿Te acuerdas del jardín en primavera? Las rosas ya están floreciendo. Estás a salvo, te queremos y aquí estoy contigo cuando me necesites.”",
  },
  record: { en: "Record", es: "Grabar" },
  stop: { en: "Stop", es: "Detener" },
  upload: { en: "Upload audio", es: "Subir audio" },
  needMore: { en: "{s}s recorded — about 30s or more sounds more like you.", es: "{s}s grabados — con unos 30s o más suena más como tú." },
  enough: { en: "{s}s recorded — that's enough.", es: "{s}s grabados — es suficiente." },
  consent: {
    en: "This is my own voice (or I have permission from the speaker) and I agree to create a temporary synthetic copy for this demo. It is deleted automatically after a few hours.",
    es: "Esta es mi propia voz (o tengo el permiso de quien habla) y acepto crear una copia sintética temporal para esta demostración. Se elimina automáticamente en unas horas.",
  },
  create: { en: "Create my voice", es: "Crear mi voz" },
  creating: { en: "Creating your voice…", es: "Creando tu voz…" },
  created: { en: "Done! Press “Hear it”, then open Talk.", es: "¡Listo! Presiona “Escucharla” y luego abre Hablar." },
  hear: { en: "Hear it", es: "Escucharla" },
  remove: { en: "Remove", es: "Quitar" },
  micDenied: { en: "We couldn't use the microphone — allow access, or upload an audio file instead.", es: "No pudimos usar el micrófono — permite el acceso o sube un archivo de audio." },
  fail: { en: "Something went wrong. The default demo voice is still active.", es: "Algo salió mal. La voz de demostración predeterminada sigue activa." },
  previewLine: { en: "Good morning, Rosa. I'm right here with you. Let's look at some photos together.", es: "Buenos días, Rosa. Aquí estoy contigo. Vamos a ver unas fotos juntas." },
};

const toBase64 = async (blob: Blob) => {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
};

export function DemoFamiliarVoiceCard({ L }: { L: Lang }) {
  const { caregiverName, setCaregiverName, enabled, setEnabled, emotion, setEmotion } = useFamiliarVoice();
  const voice = useDemoVoice();
  const [clips, setClips] = useState<Clip[]>([]);
  const [consent, setConsent] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => { if (timerRef.current) window.clearInterval(timerRef.current); }, []);
  const total = clips.reduce((n, c) => n + c.seconds, 0);

  async function startRec() {
    setMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const seconds = Math.max(1, Math.round((Date.now() - startedRef.current) / 1000));
        setClips((c) => [...c, { id: crypto.randomUUID(), blob, url: URL.createObjectURL(blob), seconds, name: `recording-${c.length + 1}` }].slice(0, 3));
      };
      startedRef.current = Date.now();
      rec.start();
      recRef.current = rec;
      setRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(() => {
        const s = Math.round((Date.now() - startedRef.current) / 1000);
        setElapsed(s);
        if (s >= 90) stopRec();
      }, 500);
    } catch {
      setMsg({ ok: false, text: T.micDenied[L] });
    }
  }
  function stopRec() {
    try { recRef.current?.stop(); } catch {}
    if (timerRef.current) window.clearInterval(timerRef.current);
    setRecording(false);
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const added: Clip[] = [];
    for (const f of Array.from(files).slice(0, 3)) {
      if (f.size > 6 * 1024 * 1024) continue;
      const url = URL.createObjectURL(f);
      const seconds = await new Promise<number>((res) => {
        const a = new Audio(url);
        a.onloadedmetadata = () => res(Number.isFinite(a.duration) ? Math.round(a.duration) : 0);
        a.onerror = () => res(0);
      });
      added.push({ id: crypto.randomUUID(), blob: f, url, seconds, name: f.name });
    }
    setClips((c) => [...c, ...added].slice(0, 3));
  }

  async function create() {
    setBusy(true);
    setMsg(null);
    try {
      const samples = await Promise.all(
        clips.map(async (c) => ({
          base64: await toBase64(c.blob),
          contentType: c.blob.type || "audio/webm",
          filename: c.name.includes(".") ? c.name : `${c.name}.${(c.blob.type.split("/")[1] || "webm").split(";")[0]}`,
        })),
      );
      const r = await withClientTimeout(cloneDemoVoice({ data: { name: caregiverName || "María", consent: true as const, samples } }), 90_000);
      if (r.ok) {
        voice.set(r.token, r.name);
        setClips([]);
        setConsent(false);
        setMsg({ ok: true, text: T.created[L] });
      } else setMsg({ ok: false, text: r.error });
    } catch {
      setMsg({ ok: false, text: T.fail[L] });
    } finally {
      setBusy(false);
    }
  }

  async function hear() {
    if (!voice.token) return;
    stopFamiliarVoice();
    stopCaregiverSpeech();
    try {
      const r = await withClientTimeout(demoSpeak({ data: { token: voice.token, text: T.previewLine[L], emotion: emotion === "auto" ? undefined : emotion } }), 12_000);
      if (r.audio && (await playAudioB64(r.audio))) return;
    } catch {}
    setMsg({ ok: false, text: T.fail[L] });
  }

  async function remove() {
    const t = voice.token;
    voice.set(null);
    if (t) { try { await removeDemoVoice({ data: { token: t } }); } catch {} }
    setMsg(null);
  }

  const canCreate = clips.length > 0 && consent && !busy && !recording;
  const btn = "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm min-h-11";

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="h-10 w-10 rounded-full bg-tint text-tint-foreground inline-flex items-center justify-center shrink-0">
            <Volume2 size={20} />
          </span>
          <div className="min-w-0">
            <p className="font-semibold leading-tight">{T.title[L]}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{T.sub[L]}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          className={`shrink-0 text-xs rounded-full px-3 py-1 font-medium ${enabled ? "bg-tint text-tint-foreground" : "bg-muted text-muted-foreground"}`}
        >
          {enabled ? T.on[L] : T.off[L]}
        </button>
      </div>

      {voice.token && (
        <div className="rounded-lg bg-muted text-foreground px-3 py-2 text-sm flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1"><Check size={14} /> {T.active[L]}{voice.name ? ` · ${voice.name}` : ""}</span>
          <button type="button" onClick={hear} className={`${btn} bg-card border border-border`}><Play size={16} /> {T.hear[L]}</button>
          <button type="button" onClick={remove} className={`${btn} text-muted-foreground`}><Trash2 size={16} /> {T.remove[L]}</button>
        </div>
      )}

      <EmotionPicker value={emotion} onChange={(e) => { setEmotion(e); }} lang={L} label={T.emotion[L]} />

      <label className="block text-xs">
        <span className="text-muted-foreground">{T.nameLabel[L]}</span>
        <input
          value={caregiverName}
          onChange={(e) => setCaregiverName(e.target.value || "María")}
          maxLength={40}
          className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
        />
      </label>

      <blockquote className="text-xs text-muted-foreground border-l-4 border-border pl-3">{T.script[L]}</blockquote>

      <div className="flex flex-wrap gap-2 items-center">
        {!recording ? (
          <button type="button" onClick={startRec} disabled={clips.length >= 3} className={`${btn} bg-primary text-primary-foreground font-medium disabled:opacity-50`}>
            <Mic size={16} /> {T.record[L]}
          </button>
        ) : (
          <button type="button" onClick={stopRec} className={`${btn} bg-destructive text-destructive-foreground font-medium`}>
            <Square size={16} /> {T.stop[L]} ({elapsed}s)
          </button>
        )}
        <label className={`${btn} border border-border cursor-pointer`}>
          <Upload size={16} /> {T.upload[L]}
          <input type="file" accept="audio/*" multiple className="sr-only" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
        </label>
      </div>

      {clips.length > 0 && (
        <ul className="space-y-2">
          {clips.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <audio controls src={c.url} className="h-10 flex-1 min-w-0" />
              <span className="text-xs text-muted-foreground w-9">{c.seconds}s</span>
              <button type="button" onClick={() => setClips((all) => all.filter((x) => x.id !== c.id))} aria-label="Remove clip" className="p-2 text-muted-foreground"><Trash2 size={16} /></button>
            </li>
          ))}
          <li className="text-xs text-muted-foreground">{(total < 30 ? T.needMore : T.enough)[L].replace("{s}", String(total))}</li>
        </ul>
      )}

      <label className="flex gap-2 items-start text-xs">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
        <span>{T.consent[L]}</span>
      </label>

      <button type="button" onClick={create} disabled={!canCreate} className={`${btn} bg-primary text-primary-foreground font-medium disabled:opacity-50`}>
        {busy ? T.creating[L] : T.create[L]}
      </button>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-foreground" : "text-destructive"}`}>{msg.ok ? "✓ " : "✕ "}{msg.text}</p>}
    </div>
  );
}
