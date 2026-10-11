-- The "*_no_client_writes" policies were RESTRICTIVE FOR ALL USING (false), which
-- also blocks SELECT for the authenticated role (so a signed-in user could not even
-- read their own membership). Intent is "no client writes": narrow them to writes.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE permissive = 'RESTRICTIVE' AND cmd = 'ALL' AND policyname LIKE '%no_client_writes'
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    EXECUTE format('CREATE POLICY %I ON %I.%I AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (false)', p.policyname || '_ins', p.schemaname, p.tablename);
    EXECUTE format('CREATE POLICY %I ON %I.%I AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false)', p.policyname || '_upd', p.schemaname, p.tablename);
    EXECUTE format('CREATE POLICY %I ON %I.%I AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false)', p.policyname || '_del', p.schemaname, p.tablename);
  END LOOP;
END $$;
