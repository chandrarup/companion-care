
-- Helper: is the caller a clinician on this household?
CREATE OR REPLACE FUNCTION public.is_clinician_member(_household_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.memberships
     WHERE household_id = _household_id AND user_id = _user_id
       AND role = 'clinician' AND deleted_at IS NULL
  );
$$;

-- Caregiver concerns: 1-3 questions to raise next visit
CREATE TABLE public.caregiver_concerns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.users(id),
  text text NOT NULL CHECK (length(text) BETWEEN 1 AND 500),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.caregiver_concerns TO authenticated;
GRANT ALL ON public.caregiver_concerns TO service_role;
ALTER TABLE public.caregiver_concerns ENABLE ROW LEVEL SECURITY;
CREATE POLICY concerns_member_nonclinician_all ON public.caregiver_concerns FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()) AND NOT public.is_clinician_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()) AND NOT public.is_clinician_member(household_id, auth.uid()));
CREATE INDEX caregiver_concerns_household_idx ON public.caregiver_concerns(household_id, created_at DESC);
CREATE TRIGGER set_caregiver_concerns_updated_at BEFORE UPDATE ON public.caregiver_concerns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Lock down raw data from clinicians: drop existing FOR ALL policies and recreate with NOT clinician
DROP POLICY IF EXISTS patient_profile_member_all ON public.patient_profile;
CREATE POLICY patient_profile_member_all ON public.patient_profile FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()) AND NOT public.is_clinician_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()) AND NOT public.is_clinician_member(household_id, auth.uid()));

DROP POLICY IF EXISTS media_member_all ON public.media;
CREATE POLICY media_member_all ON public.media FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()) AND NOT public.is_clinician_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()) AND NOT public.is_clinician_member(household_id, auth.uid()));

DROP POLICY IF EXISTS daily_logs_member_all ON public.daily_logs;
CREATE POLICY daily_logs_member_all ON public.daily_logs FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()) AND NOT public.is_clinician_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()) AND NOT public.is_clinician_member(household_id, auth.uid()));

DROP POLICY IF EXISTS log_symptoms_member_all ON public.log_symptoms;
CREATE POLICY log_symptoms_member_all ON public.log_symptoms FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.daily_logs dl WHERE dl.id = daily_log_id
    AND public.is_household_member(dl.household_id, auth.uid())
    AND NOT public.is_clinician_member(dl.household_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.daily_logs dl WHERE dl.id = daily_log_id
    AND public.is_household_member(dl.household_id, auth.uid())
    AND NOT public.is_clinician_member(dl.household_id, auth.uid())));

DROP POLICY IF EXISTS episodes_member_all ON public.episodes;
CREATE POLICY episodes_member_all ON public.episodes FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()) AND NOT public.is_clinician_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()) AND NOT public.is_clinician_member(household_id, auth.uid()));

DROP POLICY IF EXISTS cues_member_all ON public.cues;
CREATE POLICY cues_member_all ON public.cues FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()) AND NOT public.is_clinician_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()) AND NOT public.is_clinician_member(household_id, auth.uid()));

DROP POLICY IF EXISTS cue_events_member_all ON public.cue_events;
CREATE POLICY cue_events_member_all ON public.cue_events FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cues c WHERE c.id = cue_id
    AND public.is_household_member(c.household_id, auth.uid())
    AND NOT public.is_clinician_member(c.household_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cues c WHERE c.id = cue_id
    AND public.is_household_member(c.household_id, auth.uid())
    AND NOT public.is_clinician_member(c.household_id, auth.uid())));

DROP POLICY IF EXISTS fp_member_all ON public.fingerprint_insights;
CREATE POLICY fp_member_all ON public.fingerprint_insights FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()) AND NOT public.is_clinician_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()) AND NOT public.is_clinician_member(household_id, auth.uid()));

-- Physician summaries: clinicians read only; other members keep full access
DROP POLICY IF EXISTS ps_member_all ON public.physician_summaries;
CREATE POLICY ps_member_read ON public.physician_summaries FOR SELECT TO authenticated
  USING (public.is_household_member(household_id, auth.uid()));
CREATE POLICY ps_member_write ON public.physician_summaries FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member(household_id, auth.uid()) AND NOT public.is_clinician_member(household_id, auth.uid()));
CREATE POLICY ps_member_update ON public.physician_summaries FOR UPDATE TO authenticated
  USING (public.is_household_member(household_id, auth.uid()) AND NOT public.is_clinician_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()) AND NOT public.is_clinician_member(household_id, auth.uid()));
CREATE POLICY ps_member_delete ON public.physician_summaries FOR DELETE TO authenticated
  USING (public.is_household_member(household_id, auth.uid()) AND NOT public.is_clinician_member(household_id, auth.uid()));
