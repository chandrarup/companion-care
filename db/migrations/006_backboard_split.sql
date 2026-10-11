-- Two Backboard assistants per household:
--   backboard_assistant_id       = life story (patient-safe; the ONLY memory patient chat may use)
--   backboard_care_assistant_id  = care log (caregiver-only: daily logs, symptoms, what was said)
-- backboard_thread_id now belongs to the care assistant.
ALTER TABLE public.households ADD COLUMN IF NOT EXISTS backboard_care_assistant_id text;
UPDATE public.households SET backboard_assistant_id = NULL, backboard_thread_id = NULL; -- reset dev data written before the split

-- Small server-only key/value store (e.g. the shared demo Backboard assistant id).
CREATE TABLE IF NOT EXISTS public.app_kv (key text PRIMARY KEY, value text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.app_kv ENABLE ROW LEVEL SECURITY;  -- no policies: only the owner connection can read/write
