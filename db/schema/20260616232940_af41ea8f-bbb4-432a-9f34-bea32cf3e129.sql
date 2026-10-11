
-- Music provider on patient profile + disliked songs list
ALTER TABLE public.patient_profile
  ADD COLUMN IF NOT EXISTS music_provider TEXT,
  ADD COLUMN IF NOT EXISTS music_disliked TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.patient_profile DROP CONSTRAINT IF EXISTS patient_profile_music_provider_check;
ALTER TABLE public.patient_profile
  ADD CONSTRAINT patient_profile_music_provider_check
  CHECK (music_provider IS NULL OR music_provider = ANY(ARRAY['apple','spotify','amazon','upload']));

-- Music intervention sessions
CREATE TABLE IF NOT EXISTS public.music_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES public.episodes(id) ON DELETE SET NULL,
  song_label TEXT,
  provider TEXT,
  started_by UUID REFERENCES public.users(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  helped TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT music_sessions_helped_check CHECK (helped IS NULL OR helped = ANY(ARRAY['helped','no_change','worse']))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.music_sessions TO authenticated;
GRANT ALL ON public.music_sessions TO service_role;
ALTER TABLE public.music_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "music_sessions_member_all" ON public.music_sessions
  FOR ALL TO authenticated
  USING (is_household_member(household_id, auth.uid()) AND NOT is_clinician_member(household_id, auth.uid()))
  WITH CHECK (is_household_member(household_id, auth.uid()) AND NOT is_clinician_member(household_id, auth.uid()));

CREATE TRIGGER trg_music_sessions_updated BEFORE UPDATE ON public.music_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS music_sessions_household_idx ON public.music_sessions(household_id, started_at DESC) WHERE deleted_at IS NULL;

-- Training "did it help?" feedback
CREATE TABLE IF NOT EXISTS public.training_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  training_id UUID NOT NULL REFERENCES public.training_content(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  tried_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  helped TEXT,
  action_saved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT training_feedback_helped_check CHECK (helped IS NULL OR helped = ANY(ARRAY['helped','no_change','worse']))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_feedback TO authenticated;
GRANT ALL ON public.training_feedback TO service_role;
ALTER TABLE public.training_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_feedback_member_all" ON public.training_feedback
  FOR ALL TO authenticated
  USING (is_household_member(household_id, auth.uid()) AND NOT is_clinician_member(household_id, auth.uid()))
  WITH CHECK (is_household_member(household_id, auth.uid()) AND NOT is_clinician_member(household_id, auth.uid()));

CREATE TRIGGER trg_training_feedback_updated BEFORE UPDATE ON public.training_feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS training_feedback_household_idx ON public.training_feedback(household_id, tried_at DESC) WHERE deleted_at IS NULL;

-- Optional self-host flag on training_content
ALTER TABLE public.training_content
  ADD COLUMN IF NOT EXISTS self_hosted BOOLEAN NOT NULL DEFAULT false;
