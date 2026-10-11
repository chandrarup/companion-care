import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useT } from "@/i18n/I18nProvider";
import { cloneCaregiverVoice, getVoiceStatus, removeCaregiverVoice, setVoiceEmotion } from "@/lib/voice.functions";
import { EmotionPicker } from "@/components/EmotionPicker";
import type { VoiceMood } from "@/lib/voice-emotion";
import { playCaregiverSpeech, resetCaregiverVoiceCache } from "@/lib/caregiver-voice";

type Clip = { id: string; blob: Blob; url: string; seconds: number; name: string };

const toBase64 = async (blob: Blob) => {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
};

/** Caregiver records (or uploads) their voice; ElevenLabs clones it; patient mode then speaks in it. */
export function VoiceCloneCard() {
  const { t, lang } = useT();
  const statusFn = useServerFn(getVoiceStatus);
  const cloneFn = useServerFn(cloneCaregiverVoice);
  const removeFn = useServerFn(removeCaregiverVoice);
  const emotionFn = useServerFn(setVoiceEmotion);

  const [status, setStatus] = useState<{ available: boolean; hasVoice: boolean; name: string | null; emotion: VoiceMood } | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await statusFn());
    } catch {
      setStatus({ available: false, hasVoice: false, name: null, emotion: "auto" });
    }
  }, [statusFn]);
  useEffect(() => { refresh(); }, [refresh]);
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
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const seconds = Math.max(1, Math.round((Date.now() - startedRef.current) / 1000));
        setClips((c) => [...c, { id: crypto.randomUUID(), blob, url: URL.createObjectURL(blob), seconds, name: `recording-${c.length + 1}` }]);
      };
      startedRef.current = Date.now();
      rec.start();
      recRef.current = rec;
      setRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed(Math.round((Date.now() - startedRef.current) / 1000)), 500);
    } catch {
      setMsg({ kind: "err", text: t("voice.micDenied") });
    }
  }
  function stopRec() {
    recRef.current?.stop();
    if (timerRef.current) window.clearInterval(timerRef.current);
    setRecording(false);
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const added: Clip[] = [];
    for (const f of Array.from(files).slice(0, 5)) {
      const url = URL.createObjectURL(f);
      const seconds = await new Promise<number>((res) => {
        const a = new Audio(url);
        a.onloadedmetadata = () => res(Number.isFinite(a.duration) ? Math.round(a.duration) : 0);
        a.onerror = () => res(0);
      });
      added.push({ id: crypto.randomUUID(), blob: f, url, seconds, name: f.name });
    }
    setClips((c) => [...c, ...added].slice(0, 5));
  }

  async function create() {
    setBusy(true);
    setMsg(null);
    try {
      const samples = await Promise.all(
        clips.map(async (c, i) => ({
          base64: await toBase64(c.blob),
          contentType: c.blob.type || "audio/webm",
          filename: c.name.includes(".") ? c.name : `${c.name}.${(c.blob.type.split("/")[1] || "webm").split(";")[0]}`,
        })),
      );
      await cloneFn({ data: { name: name.trim(), consent: true as const, samples } });
      resetCaregiverVoiceCache();
      setClips([]);
      setConsent(false);
      setMsg({ kind: "ok", text: t("voice.created") });
      await refresh();
    } catch (e: any) {
      setMsg({ kind: "err", text: e?.message ?? t("voice.failed") });
    } finally {
      setBusy(false);
    }
  }

  async function preview() {
    setMsg(null);
    const ok = await playCaregiverSpeech(t("voice.previewLine"));
    if (!ok) setMsg({ kind: "err", text: t("voice.previewFailed") });
  }

  async function chooseEmotion(e: VoiceMood) {
    setMsg(null);
    setStatus((s) => (s ? { ...s, emotion: e } : s));
    try {
      await emotionFn({ data: { emotion: e } });
      resetCaregiverVoiceCache();
      await playCaregiverSpeech(t("voice.previewLine")); // hear the new feeling straight away
    } catch (err: any) {
      setMsg({ kind: "err", text: err?.message ?? t("voice.failed") });
      await refresh();
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await removeFn();
      resetCaregiverVoiceCache();
      await refresh();
      setMsg({ kind: "ok", text: t("voice.removed") });
    } catch (e: any) {
      setMsg({ kind: "err", text: e?.message ?? t("voice.failed") });
    } finally {
      setBusy(false);
    }
  }

  const canCreate = clips.length > 0 && name.trim().length > 0 && consent && !busy && !recording;

  return (
    <section className="space-y-3 mb-6" aria-labelledby="voice-h">
      <h2 id="voice-h" className="font-medium">{t("voice.title")}</h2>
      <p className="text-sm text-muted-foreground">{t("voice.help")}</p>

      {status && !status.available && <p className="text-sm text-destructive">{t("voice.notConfigured")}</p>}

      {status?.hasVoice && (
        <div className="rounded-md border border-border bg-card p-3 space-y-2">
          <p>✓ {t("voice.active", { name: status.name ?? "" })}</p>
          <EmotionPicker value={status.emotion} onChange={chooseEmotion} lang={lang === "es" ? "es" : "en"} label={lang === "es" ? "Cómo suena la voz" : "How the voice sounds"} />
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={preview} className="px-4 py-2 rounded-md bg-primary text-primary-foreground min-h-12" data-touch>
              ▶ {t("voice.preview")}
            </button>
            <button type="button" onClick={remove} disabled={busy} className="px-4 py-2 rounded-md border border-border min-h-12 disabled:opacity-50" data-touch>
              {t("voice.remove")}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-md border border-border bg-card p-3 space-y-3">
        <p className="text-sm font-medium">{status?.hasVoice ? t("voice.replace") : t("voice.record")}</p>
        <blockquote className="text-sm border-l-4 border-border pl-3 text-muted-foreground">{t("voice.script")}</blockquote>

        <div className="flex gap-2 flex-wrap items-center">
          {!recording ? (
            <button type="button" onClick={startRec} disabled={clips.length >= 5} className="px-4 py-2 rounded-md bg-primary text-primary-foreground min-h-12 disabled:opacity-50" data-touch>
              ● {t("voice.startRec")}
            </button>
          ) : (
            <button type="button" onClick={stopRec} className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground min-h-12" data-touch>
              ■ {t("voice.stopRec")} ({elapsed}s)
            </button>
          )}
          <label className="px-4 py-2 rounded-md border border-border min-h-12 inline-flex items-center cursor-pointer">
            {t("voice.upload")}
            <input type="file" accept="audio/*" multiple className="sr-only" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
          </label>
        </div>

        {clips.length > 0 && (
          <ul className="space-y-2">
            {clips.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <audio controls src={c.url} className="h-10 flex-1 min-w-0" />
                <span className="text-xs text-muted-foreground w-10">{c.seconds}s</span>
                <button type="button" onClick={() => setClips((all) => all.filter((x) => x.id !== c.id))} className="text-sm underline">
                  {t("common.remove")}
                </button>
              </li>
            ))}
          </ul>
        )}
        {clips.length > 0 && (
          <p className={`text-sm ${total < 60 ? "text-muted-foreground" : ""}`}>
            {total < 60 ? t("voice.needMore", { seconds: total }) : t("voice.enough", { seconds: total })}
          </p>
        )}

        <label className="block">
          <span className="block mb-1 text-sm">{t("voice.nameLabel")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="w-full px-3 py-3 border border-input rounded-md bg-background" placeholder={t("voice.namePlaceholder")} />
        </label>

        <label className="flex gap-2 items-start text-sm">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-5 w-5" />
          <span>{t("voice.consent")}</span>
        </label>

        <button type="button" onClick={create} disabled={!canCreate || !status?.available} className="px-4 py-3 rounded-md bg-primary text-primary-foreground min-h-12 disabled:opacity-50" data-touch>
          {busy ? t("common.loading") : t("voice.create")}
        </button>
        {msg && (
          <p role={msg.kind === "err" ? "alert" : "status"} className={msg.kind === "err" ? "text-destructive" : ""}>
            {msg.kind === "err" ? "✕ " : "✓ "}{msg.text}
          </p>
        )}
      </div>
    </section>
  );
}
