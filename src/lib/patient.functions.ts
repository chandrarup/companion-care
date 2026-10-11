import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EMPTY_PATIENT_BUNDLE = {
  name: "",
  language: "en",
  music: [] as string[],
  music_provider: null as string | null,
  greeting_audio_url: null as string | null,
  photos: [] as Array<{ id: string; caption: string | null; url: string; audio_url: string | null }>,
};

/** Returns ONLY patient-safe content: photos with signed URLs, music titles, greeting audio URL, patient name. No clinical/log content. */
export const getPatientBundle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: m, error: membershipError } = await context.supabase
      .from("memberships")
      .select("household_id")
      .eq("user_id", context.userId)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (membershipError) throw new Error(membershipError.message);
    if (!m?.household_id) return EMPTY_PATIENT_BUNDLE;

    const householdId = m.household_id;

    const [{ data: patient }, { data: photos }] = await Promise.all([
      context.supabase
        .from("patient_profile")
        .select("display_name, language, music_preferences, music_disliked, music_provider, greeting_audio_path")
        .eq("household_id", householdId)
        .maybeSingle(),
      context.supabase
        .from("media")
        .select("id, storage_path, caption, audio_path")
        .eq("household_id", householdId)
        .eq("kind", "photo")
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(60),
    ]);

    const bucket = context.supabase.storage.from("family-photos");
    const sign = async (path: string | null) => {
      if (!path) return null;
      // Allow pre-resolved URLs (e.g. demo seed data using external image hosts).
      if (/^https?:\/\//i.test(path)) return path;
      const { data } = await bucket.createSignedUrl(path, 60 * 60);
      return data?.signedUrl ?? null;
    };

    const signedPhotos = await Promise.all(
      (photos ?? []).map(async (p: any) => ({
        id: p.id,
        caption: p.caption,
        url: await sign(p.storage_path),
        audio_url: await sign(p.audio_path),
      })),
    );

    return {
      name: patient?.display_name ?? "",
      language: patient?.language ?? "en",
      music: (((patient as any)?.music_preferences ?? []) as string[]).filter(
        (s) => !(((patient as any)?.music_disliked ?? []) as string[]).includes(s),
      ),
      music_provider: ((patient as any)?.music_provider ?? null) as string | null,
      greeting_audio_url: await sign(patient?.greeting_audio_path ?? null),
      photos: signedPhotos.filter((p) => p.url),
    };
  });

/** Pending cues for patient screen — title + spoken prompt only, no clinical context. */
export const getDueCues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: m } = await context.supabase
      .from("memberships")
      .select("household_id")
      .eq("user_id", context.userId)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (!m) return { cues: [] };
    const { data } = await context.supabase
      .from("cues")
      .select("id, label, cue_type, schedule_times, days_of_week")
      .eq("household_id", m.household_id)
      .is("deleted_at", null);
    return { cues: data ?? [] };
  });