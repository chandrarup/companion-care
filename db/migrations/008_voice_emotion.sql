-- How the caregiver's cloned voice speaks: warm (default), calm, cheerful, gentle.
ALTER TABLE public.patient_profile
  ADD COLUMN IF NOT EXISTS caregiver_voice_emotion text NOT NULL DEFAULT 'warm'
  CHECK (caregiver_voice_emotion IN ('warm','calm','cheerful','gentle'));
