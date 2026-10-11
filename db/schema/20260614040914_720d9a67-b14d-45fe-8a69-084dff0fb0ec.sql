
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin','primary_caregiver','family','friend','clinician');
CREATE TYPE public.membership_role AS ENUM ('primary_caregiver','family','friend','clinician');
CREATE TYPE public.app_language AS ENUM ('en','es');

-- updated_at trigger fn
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- households
CREATE TABLE public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  preferred_language public.app_language NOT NULL DEFAULT 'en',
  edit_lock_days integer NOT NULL DEFAULT 3,
  pin_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.households TO authenticated;
GRANT ALL ON public.households TO service_role;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_households_updated BEFORE UPDATE ON public.households FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- users (mirror)
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  preferred_language public.app_language NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_self_read ON public.users FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY users_self_update ON public.users FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- auto-create user row on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_auth_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users(id, email) VALUES (NEW.id, NEW.email) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- memberships
CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  role public.membership_role NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (user_id, household_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_memberships_updated BEFORE UPDATE ON public.memberships FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- helper: is user member of household
CREATE OR REPLACE FUNCTION public.is_household_member(_household_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.memberships
    WHERE household_id = _household_id AND user_id = _user_id AND deleted_at IS NULL
  );
$$;

-- now households + memberships policies using helper
CREATE POLICY households_member_read ON public.households FOR SELECT TO authenticated
  USING (public.is_household_member(id, auth.uid()));
CREATE POLICY households_member_update ON public.households FOR UPDATE TO authenticated
  USING (public.is_household_member(id, auth.uid()));
-- Inserts go through server functions (service role); no INSERT policy = blocked from client.

CREATE POLICY memberships_self_read ON public.memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_household_member(household_id, auth.uid()));

-- user_roles (per platform pattern)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_roles_self_read ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- patient_profile
CREATE TABLE public.patient_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL UNIQUE REFERENCES public.households(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  language public.app_language NOT NULL DEFAULT 'en',
  biography text,
  daily_routines text,
  music_preferences text[] NOT NULL DEFAULT '{}',
  known_triggers text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_profile TO authenticated;
GRANT ALL ON public.patient_profile TO service_role;
ALTER TABLE public.patient_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY patient_profile_member_all ON public.patient_profile FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()));
CREATE TRIGGER trg_pp_updated BEFORE UPDATE ON public.patient_profile FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- media
CREATE TABLE public.media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  kind text NOT NULL DEFAULT 'photo',
  caption text,
  tags text[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media TO authenticated;
GRANT ALL ON public.media TO service_role;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
CREATE POLICY media_member_all ON public.media FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()));
CREATE TRIGGER trg_media_updated BEFORE UPDATE ON public.media FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Stub tables for later slices
CREATE TABLE public.daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT current_date,
  notes text,
  mood text,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_logs TO authenticated;
GRANT ALL ON public.daily_logs TO service_role;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY daily_logs_member_all ON public.daily_logs FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()));
CREATE TRIGGER trg_dl_updated BEFORE UPDATE ON public.daily_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.log_symptoms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id uuid NOT NULL REFERENCES public.daily_logs(id) ON DELETE CASCADE,
  symptom text NOT NULL,
  severity integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.log_symptoms TO authenticated;
GRANT ALL ON public.log_symptoms TO service_role;
ALTER TABLE public.log_symptoms ENABLE ROW LEVEL SECURITY;
CREATE POLICY log_symptoms_member_all ON public.log_symptoms FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.daily_logs dl WHERE dl.id = daily_log_id AND public.is_household_member(dl.household_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.daily_logs dl WHERE dl.id = daily_log_id AND public.is_household_member(dl.household_id, auth.uid())));

CREATE TABLE public.episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  description text,
  severity integer,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.episodes TO authenticated;
GRANT ALL ON public.episodes TO service_role;
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY episodes_member_all ON public.episodes FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()));
CREATE TRIGGER trg_ep_updated BEFORE UPDATE ON public.episodes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.cues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  label text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cues TO authenticated;
GRANT ALL ON public.cues TO service_role;
ALTER TABLE public.cues ENABLE ROW LEVEL SECURITY;
CREATE POLICY cues_member_all ON public.cues FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()));
CREATE TRIGGER trg_cues_updated BEFORE UPDATE ON public.cues FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.cue_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cue_id uuid NOT NULL REFERENCES public.cues(id) ON DELETE CASCADE,
  outcome text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cue_events TO authenticated;
GRANT ALL ON public.cue_events TO service_role;
ALTER TABLE public.cue_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY cue_events_member_all ON public.cue_events FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cues c WHERE c.id = cue_id AND public.is_household_member(c.household_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cues c WHERE c.id = cue_id AND public.is_household_member(c.household_id, auth.uid())));

CREATE TABLE public.fingerprint_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  insight jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fingerprint_insights TO authenticated;
GRANT ALL ON public.fingerprint_insights TO service_role;
ALTER TABLE public.fingerprint_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY fp_member_all ON public.fingerprint_insights FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()));

CREATE TABLE public.training_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  language public.app_language NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT ON public.training_content TO authenticated;
GRANT ALL ON public.training_content TO service_role;
ALTER TABLE public.training_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY training_read_all ON public.training_content FOR SELECT TO authenticated USING (deleted_at IS NULL);

CREATE TABLE public.physician_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  summary text NOT NULL,
  period_start date,
  period_end date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.physician_summaries TO authenticated;
GRANT ALL ON public.physician_summaries TO service_role;
ALTER TABLE public.physician_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY ps_member_all ON public.physician_summaries FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()));

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid REFERENCES public.households(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.users(id),
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_member_read ON public.audit_log FOR SELECT TO authenticated
  USING (household_id IS NULL OR public.is_household_member(household_id, auth.uid()));
