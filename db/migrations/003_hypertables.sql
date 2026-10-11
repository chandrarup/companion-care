-- Tiger Data / TimescaleDB: turn the event-stream tables into hypertables
-- partitioned on created_at. A hypertable's unique keys must include the time
-- column, so the primary key becomes (id, created_at). Nothing references these tables.
DO $$
DECLARE t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN RETURN; END IF;
  FOREACH t IN ARRAY ARRAY['log_symptoms', 'cue_events', 'music_sessions'] LOOP
    IF NOT EXISTS (SELECT 1 FROM timescaledb_information.hypertables WHERE hypertable_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', t, t || '_pkey');
      EXECUTE format('ALTER TABLE public.%I ADD PRIMARY KEY (id, created_at)', t);
      PERFORM create_hypertable(format('public.%I', t)::regclass, 'created_at',
        chunk_time_interval => INTERVAL '30 days', migrate_data => true);
    END IF;
  END LOOP;
END $$;
