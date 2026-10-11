
ALTER TABLE public.daily_logs
  ADD COLUMN IF NOT EXISTS sleep_quality integer CHECK (sleep_quality BETWEEN 1 AND 5);

ALTER TABLE public.log_symptoms
  ADD COLUMN IF NOT EXISTS time_of_day text,
  ADD COLUMN IF NOT EXISTS antecedent text,
  ADD COLUMN IF NOT EXISTS intervention_tried text,
  ADD COLUMN IF NOT EXISTS outcome text;

CREATE INDEX IF NOT EXISTS daily_logs_household_date_idx
  ON public.daily_logs (household_id, log_date DESC);
