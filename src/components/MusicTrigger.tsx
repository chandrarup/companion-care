import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Music, Play } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import {
  buildProviderSearchUrl,
  getMusicSettings,
  markSongDisliked,
  recordMusicFeedback,
  startMusicSession,
} from "@/lib/music.functions";

type Settings = { name: string; provider: string | null; songs: string[]; disliked: string[] };

/**
 * Caregiver-facing one-tap "Play [name]'s music" trigger.
 * Used inside the episode log when an agitation-like symptom is selected.
 * Opens the family's connected streaming provider for the chosen song,
 * records a music_session, and prompts "did it help?" afterward.
 */
export function MusicTrigger({ episodeId }: { episodeId?: string | null }) {
  const { t } = useT();
  const getSettings = useServerFn(getMusicSettings);
  const startFn = useServerFn(startMusicSession);
  const feedbackFn = useServerFn(recordMusicFeedback);
  const dislikeFn = useServerFn(markSongDisliked);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [song, setSong] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = (await getSettings()) as Settings;
        setSettings(s);
      } catch {}
    })();
  }, [getSettings]);

  if (!settings) return null;
  if (settings.songs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        {t("music.noSongs")}
      </div>
    );
  }

  async function play(chosen: string) {
    setSong(chosen);
    try {
      const res = await startFn({ data: { song_label: chosen, episode_id: episodeId ?? null } });
      setSessionId(res.id);
    } catch {}
    const url = buildProviderSearchUrl(settings!.provider, chosen);
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    setPicking(false);
  }

  async function oneTap() {
    // pick the first non-disliked song
    if (settings!.songs.length === 1) return play(settings!.songs[0]);
    setPicking(true);
  }

  async function record(helped: "helped" | "no_change" | "worse") {
    if (!sessionId) return;
    try {
      await feedbackFn({ data: { session_id: sessionId, helped } });
    } catch {}
    setSessionId(null);
  }

  async function skipSong() {
    if (!song) return;
    try {
      await dislikeFn({ data: { song } });
      setSettings({ ...settings!, songs: settings!.songs.filter((s) => s !== song), disliked: [...settings!.disliked, song] });
    } catch {}
  }

  if (sessionId) {
    return (
      <div className="rounded-lg border-2 border-primary bg-primary/5 p-4 space-y-3">
        <p className="font-semibold">{t("music.playing", { song: song ?? "" })}</p>
        <p className="text-sm">{t("music.didItHelp")}</p>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => record("helped")} className="min-h-12 rounded-md border-2 border-border px-2 py-2">{t("music.helped")}</button>
          <button type="button" onClick={() => record("no_change")} className="min-h-12 rounded-md border-2 border-border px-2 py-2">{t("music.noChange")}</button>
          <button type="button" onClick={() => record("worse")} className="min-h-12 rounded-md border-2 border-border px-2 py-2">{t("music.worse")}</button>
        </div>
        <button type="button" onClick={skipSong} className="text-xs underline text-muted-foreground">
          {t("music.notThisSong")}
        </button>
      </div>
    );
  }

  if (picking) {
    return (
      <div className="rounded-lg border-2 border-primary/40 bg-card p-3 space-y-2">
        <p className="text-sm font-medium">{t("music.pickASong")}</p>
        <div className="flex flex-wrap gap-2">
          {settings.songs.map((s) => (
            <button key={s} type="button" onClick={() => play(s)} className="rounded-full border border-border px-3 py-2 text-sm min-h-10 inline-flex items-center gap-2">
              <Play size={14} strokeWidth={2} /> {s}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setPicking(false)} className="text-xs underline">{t("common.cancel")}</button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={oneTap}
      className="w-full rounded-2xl bg-primary text-primary-foreground px-4 py-4 text-lg font-semibold min-h-16"
    >
      <span className="inline-flex items-center justify-center gap-2"><Music size={20} strokeWidth={1.75} /> {t("music.playNameMusic", { name: settings.name || t("music.theirs") })}</span>
      {!settings.provider && <span className="block text-xs font-normal mt-1 opacity-80">{t("music.noProviderHint")}</span>}
    </button>
  );
}