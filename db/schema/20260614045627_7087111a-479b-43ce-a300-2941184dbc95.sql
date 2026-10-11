GRANT EXECUTE ON FUNCTION public.is_household_member(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.member_section_access(uuid, uuid, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_record_locked(timestamptz, uuid) TO authenticated, anon;