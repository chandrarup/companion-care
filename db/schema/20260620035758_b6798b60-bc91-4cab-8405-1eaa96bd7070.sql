
-- Revoke broad write privileges from authenticated/anon on sensitive tables.
-- All legitimate writes happen via server functions using the service role,
-- which bypasses RLS and is unaffected by these REVOKEs.

REVOKE INSERT, UPDATE, DELETE ON public.households FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.memberships FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.household_invitations FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.audit_log FROM authenticated, anon;
REVOKE DELETE ON public.users FROM authenticated, anon;

-- Keep the existing households_member_update SELECT/UPDATE behaviour: UPDATE
-- privilege on households is still needed by server-side flows running as the
-- user (e.g. settings updates via context.supabase). Re-grant UPDATE only.
GRANT UPDATE ON public.households TO authenticated;

-- Users table: explicit self-only INSERT policy so a user can ensure their
-- own profile row exists; DELETE is blocked entirely via the REVOKE above.
DROP POLICY IF EXISTS users_self_insert ON public.users;
CREATE POLICY users_self_insert ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Defensive: explicit "no authenticated writes" documentation policies for the
-- sensitive tables. With privileges revoked these are belt-and-suspenders, but
-- they make intent clear to scanners and future maintainers.
DROP POLICY IF EXISTS user_roles_no_client_writes ON public.user_roles;
CREATE POLICY user_roles_no_client_writes ON public.user_roles
  AS RESTRICTIVE FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS audit_log_no_client_writes ON public.audit_log;
CREATE POLICY audit_log_no_client_writes ON public.audit_log
  AS RESTRICTIVE FOR INSERT TO authenticated, anon
  WITH CHECK (false);

DROP POLICY IF EXISTS audit_log_no_client_mutations ON public.audit_log;
CREATE POLICY audit_log_no_client_mutations ON public.audit_log
  AS RESTRICTIVE FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS audit_log_no_client_deletes ON public.audit_log;
CREATE POLICY audit_log_no_client_deletes ON public.audit_log
  AS RESTRICTIVE FOR DELETE TO authenticated, anon
  USING (false);

DROP POLICY IF EXISTS memberships_no_client_writes ON public.memberships;
CREATE POLICY memberships_no_client_writes ON public.memberships
  AS RESTRICTIVE FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS household_invitations_no_client_writes ON public.household_invitations;
CREATE POLICY household_invitations_no_client_writes ON public.household_invitations
  AS RESTRICTIVE FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS households_no_client_insert ON public.households;
CREATE POLICY households_no_client_insert ON public.households
  AS RESTRICTIVE FOR INSERT TO authenticated, anon
  WITH CHECK (false);

DROP POLICY IF EXISTS households_no_client_delete ON public.households;
CREATE POLICY households_no_client_delete ON public.households
  AS RESTRICTIVE FOR DELETE TO authenticated, anon
  USING (false);
