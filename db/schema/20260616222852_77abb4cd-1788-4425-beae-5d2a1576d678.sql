
ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS reminder_time time NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.daily_logs
  ADD COLUMN IF NOT EXISTS quick_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sleep_hours numeric(3,1),
  ADD COLUMN IF NOT EXISTS caregiver_distress smallint CHECK (caregiver_distress BETWEEN 0 AND 4);

ALTER TABLE public.log_symptoms
  ADD COLUMN IF NOT EXISTS caregiver_distress smallint CHECK (caregiver_distress BETWEEN 0 AND 4);

ALTER TABLE public.episodes
  ADD COLUMN IF NOT EXISTS caregiver_distress smallint CHECK (caregiver_distress BETWEEN 0 AND 4);

-- Edit-lock enforcement for tables with a direct household_id
CREATE OR REPLACE FUNCTION public.enforce_edit_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  days int;
BEGIN
  -- allow soft-delete / undelete regardless of lock
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     AND ROW(NEW.*) IS NOT DISTINCT FROM ROW(OLD.*) THEN
    RETURN NEW;
  END IF;
  SELECT edit_lock_days INTO days FROM public.households WHERE id = OLD.household_id;
  IF days IS NULL THEN days := 3; END IF;
  IF OLD.created_at < (now() - make_interval(days => days)) THEN
    RAISE EXCEPTION 'Record is locked after % day(s) and can no longer be edited.', days
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_daily_logs_lock ON public.daily_logs;
CREATE TRIGGER trg_daily_logs_lock BEFORE UPDATE ON public.daily_logs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_edit_lock();

DROP TRIGGER IF EXISTS trg_episodes_lock ON public.episodes;
CREATE TRIGGER trg_episodes_lock BEFORE UPDATE ON public.episodes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_edit_lock();

-- log_symptoms has no household_id; resolve via parent daily_log
CREATE OR REPLACE FUNCTION public.enforce_edit_lock_log_symptoms()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  hh uuid;
  days int;
  parent_created timestamptz;
BEGIN
  SELECT household_id, created_at INTO hh, parent_created
    FROM public.daily_logs WHERE id = OLD.daily_log_id;
  SELECT edit_lock_days INTO days FROM public.households WHERE id = hh;
  IF days IS NULL THEN days := 3; END IF;
  IF COALESCE(parent_created, OLD.created_at) < (now() - make_interval(days => days)) THEN
    RAISE EXCEPTION 'Record is locked after % day(s) and can no longer be edited.', days
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_symptoms_lock ON public.log_symptoms;
CREATE TRIGGER trg_log_symptoms_lock BEFORE UPDATE ON public.log_symptoms
  FOR EACH ROW EXECUTE FUNCTION public.enforce_edit_lock_log_symptoms();
