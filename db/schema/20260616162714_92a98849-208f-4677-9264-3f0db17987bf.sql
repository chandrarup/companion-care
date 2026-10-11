
-- Restrict demo_responses to authenticated users only (remove anon read)
DROP POLICY IF EXISTS demo_responses_read_all ON public.demo_responses;
CREATE POLICY demo_responses_read_authenticated ON public.demo_responses
  FOR SELECT TO authenticated USING (true);

-- Restrict NULL-household audit_log rows to admins
DROP POLICY IF EXISTS audit_member_read ON public.audit_log;
CREATE POLICY audit_member_read ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    (household_id IS NOT NULL AND public.is_household_member(household_id, auth.uid()))
    OR (household_id IS NULL AND public.has_role(auth.uid(), 'admin'))
  );

-- Revoke EXECUTE on SECURITY DEFINER helper functions from anon.
-- Keep EXECUTE for authenticated; these are RLS helpers required by policies.
REVOKE EXECUTE ON FUNCTION public.is_household_member(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.member_section_access(uuid, uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_record_locked(timestamptz, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_household_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_section_access(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_record_locked(timestamptz, uuid) TO authenticated;
