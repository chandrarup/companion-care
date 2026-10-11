-- Add "auto" (match the patient's mood) and make it the default.
ALTER TABLE public.patient_profile DROP CONSTRAINT IF EXISTS patient_profile_caregiver_voice_emotion_check;
ALTER TABLE public.patient_profile ADD CONSTRAINT patient_profile_caregiver_voice_emotion_check
  CHECK (caregiver_voice_emotion IN ('auto','warm','calm','cheerful','gentle'));
ALTER TABLE public.patient_profile ALTER COLUMN caregiver_voice_emotion SET DEFAULT 'auto';
UPDATE public.patient_profile SET caregiver_voice_emotion = 'auto' WHERE caregiver_voice_emotion = 'warm';
