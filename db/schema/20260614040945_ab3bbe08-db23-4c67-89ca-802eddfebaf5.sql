
-- Files stored under family-photos/<household_id>/...
CREATE POLICY "family_photos_member_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'family-photos'
    AND public.is_household_member((string_to_array(name, '/'))[1]::uuid, auth.uid())
  );
CREATE POLICY "family_photos_member_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'family-photos'
    AND public.is_household_member((string_to_array(name, '/'))[1]::uuid, auth.uid())
  );
CREATE POLICY "family_photos_member_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'family-photos'
    AND public.is_household_member((string_to_array(name, '/'))[1]::uuid, auth.uid())
  );
CREATE POLICY "family_photos_member_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'family-photos'
    AND public.is_household_member((string_to_array(name, '/'))[1]::uuid, auth.uid())
  );
