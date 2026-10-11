import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getCallerMembership } from "./permissions";
import { safeDbError } from "./safe-errors";

/** Symptoms that should surface the music trigger button. */
export const MUSIC_TRIGGER_SYMPTOMS = [
  "agitation",
  "anxiety",
  "restlessness",
  "overstimulation",
  "sundowning",
];

export function buildProviderSearchUrl(provider: string | null, query: string): string | null {
  if (!provider || !query) return null;
  const q = encodeURIComponent(query);
  switch (provider) {
    case "spotify":
      return `https://open.spotify.com/search/${q}`;
    case "apple":
      return `https://music.apple.com/us/search?term=${q}`;
    case "amazon":
      return `https://music.amazon.com/search/${q}`;
    default:
      return null;
  }
}

/** Returns the household's music settings + the curated (non-disliked) song list. */
export const getMusicSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const m = await getCallerMembership(context.supabase, context.userId);
    const { data: p } = await context.supabase
      .from("patient_profile")
      .select("display_name, music_preferences, music_disliked, music_provider")
      .eq("household_id", m.household_id)
      .maybeSingle();
    const disliked = new Set<string>(((p as any)?.music_disliked ?? []) as string[]);
    const songs = (((p as any)?.music_preferences ?? []) as string[]).filter((s) => !disliked.has(s));
    return {
      name: (p as any)?.display_name ?? "",
      provider: ((p as any)?.music_provider ?? null) as string | null,
      songs,
      disliked: [...disliked],
    };
  });

export const updateMusicProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ provider: z.enum(["apple", "spotify", "amazon", "upload"]).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const m = await getCallerMembership(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("patient_profile")
      .update({ music_provider: data.provider })
      .eq("household_id", m.household_id);
    if (error) throw safeDbError(error);
    return { ok: true };
  });

export const markSongDisliked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ song: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const m = await getCallerMembership(context.supabase, context.userId);
    const { data: p } = await context.supabase
      .from("patient_profile")
      .select("music_disliked")
      .eq("household_id", m.household_id)
      .maybeSingle();
    const cur = new Set<string>((((p as any)?.music_disliked ?? []) as string[]));
    cur.add(data.song);
    const { error } = await context.supabase
      .from("patient_profile")
      .update({ music_disliked: [...cur] })
      .eq("household_id", m.household_id);
    if (error) throw safeDbError(error);
    return { ok: true };
  });

export const startMusicSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      song_label: z.string().optional().nullable(),
      episode_id: z.string().uuid().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const m = await getCallerMembership(context.supabase, context.userId);
    const { data: p } = await context.supabase
      .from("patient_profile")
      .select("music_provider")
      .eq("household_id", m.household_id)
      .maybeSingle();
    const { data: row, error } = await context.supabase
      .from("music_sessions")
      .insert({
        household_id: m.household_id,
        episode_id: data.episode_id ?? null,
        song_label: data.song_label ?? null,
        provider: ((p as any)?.music_provider ?? null) as string | null,
        started_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw safeDbError(error);
    return { id: (row as any).id as string };
  });

export const recordMusicFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      session_id: z.string().uuid(),
      helped: z.enum(["helped", "no_change", "worse"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const m = await getCallerMembership(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("music_sessions")
      .update({ helped: data.helped, ended_at: new Date().toISOString() })
      .eq("id", data.session_id)
      .eq("household_id", m.household_id);
    if (error) throw safeDbError(error);
    return { ok: true };
  });