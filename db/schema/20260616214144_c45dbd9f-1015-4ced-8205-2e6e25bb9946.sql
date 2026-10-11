
ALTER TABLE public.patient_profile
  ADD COLUMN IF NOT EXISTS preferred_name text,
  ADD COLUMN IF NOT EXISTS address_as text,
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS likes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dislikes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS calming_strategies text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS key_people jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS culture_faith text,
  ADD COLUMN IF NOT EXISTS profession text,
  ADD COLUMN IF NOT EXISTS hometown text,
  ADD COLUMN IF NOT EXISTS life_events text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS diagnosis_type text,
  ADD COLUMN IF NOT EXISTS diagnosis_date date,
  ADD COLUMN IF NOT EXISTS stage_self_select text,
  ADD COLUMN IF NOT EXISTS medication_names text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS conditions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS referral_consent boolean NOT NULL DEFAULT false;

ALTER TABLE public.patient_profile
  DROP CONSTRAINT IF EXISTS patient_profile_stage_check;
ALTER TABLE public.patient_profile
  ADD CONSTRAINT patient_profile_stage_check
  CHECK (stage_self_select IS NULL OR stage_self_select IN ('good_days','mixed','mostly_hard'));

ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS intake_progress jsonb NOT NULL DEFAULT '{"step1":false,"step2":false,"step3":false}'::jsonb,
  ADD COLUMN IF NOT EXISTS intake_capture_mode text NOT NULL DEFAULT 'guided';

ALTER TABLE public.households
  DROP CONSTRAINT IF EXISTS households_capture_mode_check;
ALTER TABLE public.households
  ADD CONSTRAINT households_capture_mode_check
  CHECK (intake_capture_mode IN ('guided','form'));
