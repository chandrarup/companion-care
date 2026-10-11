-- Restrict household UPDATE to primary_caregiver members only.
DROP POLICY IF EXISTS households_member_update ON public.households;

CREATE POLICY households_primary_caregiver_update ON public.households
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.household_id = households.id
      AND m.user_id = auth.uid()
      AND m.role = 'primary_caregiver'
      AND m.deleted_at IS NULL
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.household_id = households.id
      AND m.user_id = auth.uid()
      AND m.role = 'primary_caregiver'
      AND m.deleted_at IS NULL
  )
);