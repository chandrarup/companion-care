-- Backboard (long-term memory): one assistant + one running thread per household.
ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS backboard_assistant_id text,
  ADD COLUMN IF NOT EXISTS backboard_thread_id text;
