
ALTER TABLE public.patient_profile ADD COLUMN IF NOT EXISTS greeting_audio_path text;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS audio_path text;
ALTER TABLE public.physician_summaries ADD COLUMN IF NOT EXISTS stats jsonb;
ALTER TABLE public.physician_summaries ADD COLUMN IF NOT EXISTS generated_by uuid REFERENCES public.users(id);
CREATE INDEX IF NOT EXISTS physician_summaries_household_idx ON public.physician_summaries(household_id, created_at DESC);
