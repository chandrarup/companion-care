
-- Invitations
CREATE TABLE public.household_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.membership_role NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  token text NOT NULL UNIQUE,
  invited_by uuid REFERENCES public.users(id),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX household_invitations_email_idx ON public.household_invitations (lower(email));
CREATE INDEX household_invitations_household_idx ON public.household_invitations (household_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_invitations TO authenticated;
GRANT ALL ON public.household_invitations TO service_role;

ALTER TABLE public.household_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invites_member_read" ON public.household_invitations
  FOR SELECT TO authenticated
  USING (public.is_household_member(household_id, auth.uid()));

CREATE TRIGGER trg_invites_updated BEFORE UPDATE ON public.household_invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Section access helper (security definer; bypasses RLS for lookup)
CREATE OR REPLACE FUNCTION public.member_section_access(_household_id uuid, _user_id uuid, _section text)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  m_role public.membership_role;
  m_perms jsonb;
  v text;
BEGIN
  SELECT role, permissions INTO m_role, m_perms
    FROM public.memberships
   WHERE household_id = _household_id
     AND user_id = _user_id
     AND deleted_at IS NULL
   LIMIT 1;

  IF m_role IS NULL THEN RETURN NULL; END IF;
  IF m_role = 'primary_caregiver' THEN RETURN 'write'; END IF;

  IF m_role = 'clinician' THEN
    IF _section = 'physician_summary' THEN RETURN 'read'; END IF;
    RETURN NULL;
  END IF;

  v := m_perms ->> _section;
  IF v IN ('read','write') THEN RETURN v; END IF;
  RETURN NULL;
END
$$;

-- Edit lock helper
CREATE OR REPLACE FUNCTION public.is_record_locked(_created_at timestamptz, _household_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _created_at < (now() - make_interval(days => COALESCE((SELECT edit_lock_days FROM public.households WHERE id = _household_id), 3)));
$$;

-- Auto-attach new users to pending invites by email
CREATE OR REPLACE FUNCTION public.attach_pending_invites()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  inv RECORD;
BEGIN
  FOR inv IN
    SELECT * FROM public.household_invitations
     WHERE lower(email) = lower(NEW.email)
       AND accepted_at IS NULL
       AND expires_at > now()
  LOOP
    INSERT INTO public.memberships (user_id, household_id, role, permissions)
    VALUES (NEW.id, inv.household_id, inv.role, inv.permissions)
    ON CONFLICT (user_id, household_id) DO NOTHING;

    UPDATE public.household_invitations
       SET accepted_at = now()
     WHERE id = inv.id;
  END LOOP;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_attach_pending_invites ON public.users;
CREATE TRIGGER trg_attach_pending_invites
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.attach_pending_invites();
