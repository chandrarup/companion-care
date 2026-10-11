
ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS min_evidence integer NOT NULL DEFAULT 4
  CHECK (min_evidence BETWEEN 2 AND 50);

ALTER TABLE public.episodes
  ADD COLUMN IF NOT EXISTS symptom text,
  ADD COLUMN IF NOT EXISTS antecedent text,
  ADD COLUMN IF NOT EXISTS intervention_tried text,
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS time_of_day text;

-- Allow upsert-style dedupe of an (antecedent->symptom) insight per household
CREATE UNIQUE INDEX IF NOT EXISTS fingerprint_insights_household_pair_idx
  ON public.fingerprint_insights (
    household_id,
    (insight->>'kind'),
    (insight->>'antecedent'),
    (insight->>'symptom')
  )
  WHERE deleted_at IS NULL;
