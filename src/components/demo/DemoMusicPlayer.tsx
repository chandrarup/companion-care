import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, SkipForward, SkipBack, Volume2, Music as MusicIcon, Youtube, Apple } from "lucide-react";
import { DEMO_MUSIC, type DemoTrack } from "@/lib/demo/data";

type Source = "apple" | "youtube" | "builtin";
const STORE_KEY = "demo.music.source";

const APPLE_DEV_TOKEN: string | undefined = (import.meta.env as any).VITE_APPLE_MUSIC_DEVELOPER_TOKEN;

/* ---------------- script loaders ---------------- */
function loadScriptOnce(src: string, key: string): Promise<void> {
  if (typeof document === "undefined") return Promise.reject(new Error("no-dom"));
  const w = window as any;
  if (w[`__loaded_${key}`]) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-key="${key}"]`);
    if (existing) {
      existing.addEventListener("load", () => { w[`__loaded_${key}`] = true; resolve(); });
      existing.addEventListener("error", () => reject(new Error(`load:${key}`)));
      return;
    }
    const s = document.createElement("script");
    s.src = src; s.async = true; s.dataset.key = key;
    s.onload = () => { w[`__loaded_${key}`] = true; resolve(); };
    s.onerror = () => reject(new Error(`load:${key}`));
    document.head.appendChild(s);
  });
}

/* ---------------- main player ---------------- */
export function DemoMusicPlayer({ L, onBack }: { L: "en" | "es"; onBack: () => void }) {
  const [source, setSource] = useState<Source | null>(() => {
    if (typeof window === "undefined") return null;
    const s = sessionStorage.getItem(STORE_KEY) as Source | null;
    if (s === "apple" && !APPLE_DEV_TOKEN) return "youtube"; // Apple MusicKit isn't configured
    return s ?? "youtube"; // real songs by default; no picker step
  });
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true); // the "MY MUSIC" tap is the user gesture that lets playback start
  const [notice, setNotice] = useState<string | null>(null);

  const setSrc = (s: Source) => {
    sessionStorage.setItem(STORE_KEY, s);
    setSource(s);
    setNotice(null);
  };

  const fallbackToBuiltin = useCallback((msg: string) => {
    setNotice(msg);
    sessionStorage.setItem(STORE_KEY, "builtin");
    setSource("builtin");
    setTimeout(() => setNotice(null), 5000);
  }, []);

  const track = DEMO_MUSIC[index];
  const next = () => { setIndex((i) => (i + 1) % DEMO_MUSIC.length); setPlaying(true); };
  const prev = () => { setIndex((i) => (i - 1 + DEMO_MUSIC.length) % DEMO_MUSIC.length); setPlaying(true); };

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-sm underline">← {L === "es" ? "Atrás" : "Back"}</button>
        <span className="font-semibold">{L === "es" ? "Mi música" : "My Music"}</span>
        {source ? (
          <button type="button" onClick={() => setSource(null)} className="text-xs underline text-muted-foreground">
            {L === "es" ? "Cambiar fuente" : "Change source"}
          </button>
        ) : <span />}
      </div>

      {notice && (
        <div className="mb-4 rounded-xl bg-muted border border-border text-foreground px-4 py-3 text-sm">
          {notice}
        </div>
      )}

      {!source && <SourcePicker L={L} onPick={setSrc} />}

      {source && (
        <>
          <NowPlayingCard L={L} track={track} source={source} />
          {source === "apple" && (
            <AppleEngine
              track={track}
              playing={playing}
              onPlayingChange={setPlaying}
              onEnded={next}
              onError={(m) => fallbackToBuiltin(m)}
              L={L}
            />
          )}
          {source === "youtube" && (
            <YouTubeEngine
              track={track}
              playing={playing}
              onPlayingChange={setPlaying}
              onEnded={next}
              onError={(m) => { setNotice(m); next(); setTimeout(() => setNotice(null), 4000); }}
              onFatal={(m) => fallbackToBuiltin(m)}
              L={L}
            />
          )}
          {source === "builtin" && (
            <BuiltinEngine
              track={track}
              playing={playing}
              onPlayingChange={setPlaying}
              onEnded={next}
            />
          )}
          <Controls
            playing={playing}
            onToggle={() => setPlaying((p) => !p)}
            onNext={next}
            onPrev={prev}
            L={L}
          />
          <TrackList tracks={DEMO_MUSIC} activeId={track.id} onPick={(i) => { setIndex(i); setPlaying(true); }} />
        </>
      )}
    </div>
  );
}

/* ---------------- picker ---------------- */
function SourcePicker({ L, onPick }: { L: "en" | "es"; onPick: (s: Source) => void }) {
  const opts: { s: Source; icon: React.ReactNode; title: string; sub: string }[] = [
    {
      s: "apple",
      icon: <Apple className="h-7 w-7" />,
      title: L === "es" ? "Reproducir con Apple Music" : "Play with Apple Music",
      sub: L === "es" ? "Mejor calidad, tu biblioteca completa" : "Best quality, your full library",
    },
    {
      s: "youtube",
      icon: <Youtube className="h-7 w-7" />,
      title: L === "es" ? "Canciones completas (YouTube Music)" : "Full songs (YouTube Music)",
      sub: L === "es" ? "Necesita internet — sin cuenta" : "Needs internet — no account",
    },
    {
      s: "builtin",
      icon: <MusicIcon className="h-7 w-7" />,
      title: L === "es" ? "Fragmentos de 30 segundos" : "30-second previews",
      sub: L === "es" ? "Vistas previas de Apple Music — sin cuenta" : "Apple Music previews — no account",
    },
  ];
  return (
    <ul className="space-y-3">
      {opts.filter((o) => o.s !== "apple" || !!APPLE_DEV_TOKEN).map((o) => (
        <li key={o.s}>
          <button
            type="button"
            onClick={() => onPick(o.s)}
            className="w-full text-left rounded-2xl border border-border bg-card p-5 flex items-center gap-4 min-h-[88px] hover:bg-muted active:scale-[0.99] transition"
          >
            <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground inline-flex items-center justify-center shrink-0">
              {o.icon}
            </div>
            <div>
              <p className="text-lg font-semibold">{o.title}</p>
              <p className="text-muted-foreground text-sm">{o.sub}</p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ---------------- shared UI ---------------- */
function NowPlayingCard({ L, track, source }: { L: "en" | "es"; track: DemoTrack; source: Source }) {
  const tag = source === "apple" ? "Apple Music" : source === "youtube" ? "YouTube Music" : (L === "es" ? "Fragmento de 30 s" : "30-second preview");
  return (
    <div className="rounded-3xl bg-card border border-border p-6 text-foreground mb-4 text-center">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{tag}</p>
      <h2 className="mt-2 text-3xl sm:text-4xl font-semibold">{track.title}</h2>
      <p className="mt-1 text-lg text-muted-foreground">{track.artist}</p>
    </div>
  );
}

function Controls({ playing, onToggle, onNext, onPrev, L }: { playing: boolean; onToggle: () => void; onNext: () => void; onPrev: () => void; L: "en" | "es" }) {
  return (
    <div className="flex items-center justify-center gap-4 my-5">
      <button type="button" onClick={onPrev} aria-label={L === "es" ? "Anterior" : "Previous"} className="h-14 w-14 rounded-full bg-card border border-border inline-flex items-center justify-center">
        <SkipBack className="h-7 w-7" />
      </button>
      <button type="button" onClick={onToggle} aria-label={playing ? (L === "es" ? "Pausar" : "Pause") : (L === "es" ? "Reproducir" : "Play")} className="h-20 w-20 rounded-full bg-primary text-primary-foreground inline-flex items-center justify-center">
        {playing ? <Pause className="h-10 w-10" /> : <Play className="h-10 w-10" />}
      </button>
      <button type="button" onClick={onNext} aria-label={L === "es" ? "Siguiente" : "Next"} className="h-14 w-14 rounded-full bg-card border border-border inline-flex items-center justify-center">
        <SkipForward className="h-7 w-7" />
      </button>
    </div>
  );
}

function TrackList({ tracks, activeId, onPick }: { tracks: DemoTrack[]; activeId: string; onPick: (i: number) => void }) {
  return (
    <ul className="mt-2 space-y-2">
      {tracks.map((t, i) => (
        <li key={t.id}>
          <button
            type="button"
            onClick={() => onPick(i)}
            className={`w-full text-left rounded-xl border p-3 flex items-center gap-3 ${activeId === t.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}
          >
            <Volume2 className={`h-5 w-5 ${activeId === t.id ? "text-primary" : "text-muted-foreground"}`} />
            <div>
              <p className="font-medium">{t.title}</p>
              <p className="text-xs text-muted-foreground">{t.artist}</p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ---------------- Preview engine (Apple 30-second previews via the public iTunes lookup API) ---------------- */
const previewCache = new Map<string, string>();
async function resolvePreview(track: DemoTrack): Promise<string> {
  if (track.appleId && previewCache.has(track.appleId)) return previewCache.get(track.appleId)!;
  try {
    if (track.appleId) {
      const r = await fetch(`https://itunes.apple.com/lookup?id=${track.appleId}&country=us`);
      const j = await r.json();
      const url: string | undefined = j?.results?.[0]?.previewUrl;
      if (url) { previewCache.set(track.appleId, url); return url; }
    }
  } catch {/* fall through to the generic tune */}
  return track.url;
}

function BuiltinEngine({ track, playing, onPlayingChange, onEnded }: {
  track: DemoTrack; playing: boolean; onPlayingChange: (p: boolean) => void; onEnded: () => void;
}) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const playingRef = useRef(playing);
  playingRef.current = playing;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const a = ref.current; if (!a) return;
      const url = await resolvePreview(track);
      if (cancelled) return;
      a.src = url;
      if (playingRef.current) a.play().catch(() => onPlayingChange(false));
    })();
    return () => { cancelled = true; };
  }, [track.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const a = ref.current; if (!a) return;
    if (playing) a.play().catch(() => onPlayingChange(false));
    else a.pause();
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps
  return <audio ref={ref} onEnded={onEnded} preload="none" />;
}

/* ---------------- Apple MusicKit engine ---------------- */
function AppleEngine({ track, playing, onPlayingChange, onEnded, onError, L }: {
  track: DemoTrack; playing: boolean; onPlayingChange: (p: boolean) => void; onEnded: () => void; onError: (msg: string) => void; L: "en" | "es";
}) {
  const kitRef = useRef<any>(null);
  const readyRef = useRef(false);

  // configure once
  useEffect(() => {
    let cancelled = false;
    if (!APPLE_DEV_TOKEN) {
      onError(L === "es" ? "No se pudo reproducir desde Apple Music — usando fragmentos de 30 segundos." : "Couldn't play from Apple Music — playing 30-second previews instead.");
      return;
    }
    (async () => {
      try {
        await loadScriptOnce("https://js-cdn.music.apple.com/musickit/v3/musickit.js", "musickit");
        const MK = (window as any).MusicKit;
        if (!MK) throw new Error("no-musickit");
        await MK.configure({ developerToken: APPLE_DEV_TOKEN, app: { name: "Companion Demo", build: "1.0" } });
        const instance = MK.getInstance();
        if (cancelled) return;
        kitRef.current = instance;
        try { await instance.authorize(); } catch { /* user denial -> still allow previews */ }
        instance.addEventListener("playbackStateDidChange", (e: any) => {
          // 2 = playing, 3 = paused, 10 = ended
          if (e.state === 10) onEnded();
          if (e.state === 3) onPlayingChange(false);
          if (e.state === 2) onPlayingChange(true);
        });
        readyRef.current = true;
      } catch {
        onError(L === "es" ? "No se pudo reproducir desde Apple Music — usando fragmentos de 30 segundos." : "Couldn't play from Apple Music — playing 30-second previews instead.");
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // change track
  useEffect(() => {
    const k = kitRef.current; if (!k || !readyRef.current || !track.appleId) return;
    (async () => {
      try {
        await k.setQueue({ song: track.appleId });
        if (playing) await k.play();
      } catch {
        onError(L === "es" ? "No se pudo reproducir esa canción — usando fragmentos de 30 segundos." : "Couldn't play that song — playing 30-second previews instead.");
      }
    })();
  }, [track.appleId]); // eslint-disable-line react-hooks/exhaustive-deps

  // play/pause
  useEffect(() => {
    const k = kitRef.current; if (!k || !readyRef.current) return;
    if (playing) k.play().catch(() => onPlayingChange(false));
    else k.pause();
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

/* ---------------- YouTube IFrame engine (hidden) ---------------- */
function YouTubeEngine({ track, playing, onPlayingChange, onEnded, onError, onFatal, L }: {
  track: DemoTrack; playing: boolean; onPlayingChange: (p: boolean) => void; onEnded: () => void; onError: (msg: string) => void; onFatal: (msg: string) => void; L: "en" | "es";
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const readyRef = useRef(false);
  const startedRef = useRef(false);

  // load API + create player once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadScriptOnce("https://www.youtube.com/iframe_api", "ytapi");
        const w = window as any;
        await new Promise<void>((resolve) => {
          if (w.YT && w.YT.Player) return resolve();
          const prev = w.onYouTubeIframeAPIReady;
          w.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
        });
        if (cancelled || !hostRef.current || !track.ytId) return;
        playerRef.current = new w.YT.Player(hostRef.current, {
          videoId: track.ytId,
          width: "1",
          height: "1",
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1, controls: 0, autoplay: playing ? 1 : 0 },
          events: {
            onReady: () => {
              readyRef.current = true;
              if (playing) playerRef.current?.playVideo?.();
              // If the browser blocks autoplay, show "Play" instead of a silent "Pause".
              window.setTimeout(() => { if (!startedRef.current) onPlayingChange(false); }, 6000);
            },
            onStateChange: (e: any) => {
              // 0 = ended, 1 = playing, 2 = paused
              if (e.data === 0) onEnded();
              if (e.data === 1) { startedRef.current = true; onPlayingChange(true); }
              if (e.data === 2) onPlayingChange(false);
            },
            onError: () => onError(L === "es" ? "Ese video no está disponible — pasando al siguiente." : "That video isn't available — skipping to the next."),
          },
        });
      } catch {
        onFatal(L === "es" ? "No se pudo cargar YouTube — usando fragmentos de 30 segundos." : "Couldn't load YouTube — playing 30-second previews instead.");
      }
    })();
    return () => {
      cancelled = true;
      try { playerRef.current?.destroy?.(); } catch {/*noop*/}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // change track
  useEffect(() => {
    const p = playerRef.current; if (!p || !readyRef.current || !track.ytId) return;
    try {
      p.loadVideoById({ videoId: track.ytId });
      if (!playing) p.pauseVideo();
    } catch {/*noop*/}
  }, [track.ytId]); // eslint-disable-line react-hooks/exhaustive-deps

  // play/pause
  useEffect(() => {
    const p = playerRef.current; if (!p || !readyRef.current) return;
    try { if (playing) p.playVideo(); else p.pauseVideo(); } catch {/*noop*/}
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div aria-hidden className="absolute pointer-events-none opacity-0 w-px h-px overflow-hidden">
      <div ref={hostRef} />
    </div>
  );
}