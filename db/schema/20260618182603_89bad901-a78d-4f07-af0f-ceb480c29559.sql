REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_household_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_clinician_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_record_locked(timestamptz, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.member_section_access(uuid, uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.enforce_edit_lock() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.enforce_edit_lock_log_symptoms() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.attach_pending_invites() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_household_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_clinician_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_record_locked(timestamptz, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.member_section_access(uuid, uuid, text) TO authenticated, service_role;