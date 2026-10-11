-- Public-demo voice clones are temporary: tracked here so they can be capped and deleted after a few hours.
CREATE TABLE IF NOT EXISTS public.demo_voices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.demo_voices ENABLE ROW LEVEL SECURITY; -- no policies: server (owner) only

-- Keep Backboard life-story memory in step with the patient profile: any profile change marks it stale,
-- and the next companion reply rebuilds it.
ALTER TABLE public.households ADD COLUMN IF NOT EXISTS backboard_life_stale boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.mark_life_memory_stale() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.households SET backboard_life_stale = true WHERE id = NEW.household_id AND backboard_assistant_id IS NOT NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS patient_profile_mark_stale ON public.patient_profile;
CREATE TRIGGER patient_profile_mark_stale
  AFTER INSERT OR UPDATE OF display_name, preferred_name, biography, daily_routines, music_preferences, likes, dislikes,
    calming_strategies, known_triggers, key_people, culture_faith, profession, hometown, life_events, languages
  ON public.patient_profile FOR EACH ROW EXECUTE FUNCTION public.mark_life_memory_stale();
REVOKE EXECUTE ON FUNCTION public.mark_life_memory_stale() FROM PUBLIC, anon, authenticated;
