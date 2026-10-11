
REVOKE EXECUTE ON FUNCTION public.member_section_access(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_record_locked(timestamptz, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.attach_pending_invites() FROM PUBLIC, anon, authenticated;
