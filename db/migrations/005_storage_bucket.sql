-- Supabase created this bucket in its dashboard (not in a migration); recreate it.
INSERT INTO storage.buckets (id, name, public) VALUES ('family-photos', 'family-photos', false) ON CONFLICT (id) DO NOTHING;
