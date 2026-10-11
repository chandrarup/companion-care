-- ElevenLabs cloned caregiver voice (created in-app, with recorded consent).
ALTER TABLE public.patient_profile
  ADD COLUMN IF NOT EXISTS caregiver_voice_id text,
  ADD COLUMN IF NOT EXISTS caregiver_voice_name text,
  ADD COLUMN IF NOT EXISTS voice_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS voice_consent_by uuid;
