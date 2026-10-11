
ALTER TABLE public.households ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.demo_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  answer text NOT NULL,
  tag text NOT NULL DEFAULT 'cached',
  mode text NOT NULL DEFAULT 'caregiver',
  priority integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT demo_responses_tag_check CHECK (tag IN ('cached','blocked_routed','reminiscence')),
  CONSTRAINT demo_responses_mode_check CHECK (mode IN ('caregiver','patient','both'))
);

GRANT SELECT ON public.demo_responses TO authenticated, anon;
GRANT ALL ON public.demo_responses TO service_role;

ALTER TABLE public.demo_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo_responses_read_all" ON public.demo_responses
  FOR SELECT TO authenticated, anon USING (true);

CREATE TRIGGER trg_demo_responses_updated BEFORE UPDATE ON public.demo_responses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed responses
INSERT INTO public.demo_responses (label, keywords, answer, tag, mode, priority) VALUES
('afternoon_insight',
 ARRAY['afternoon','3pm','3 pm','restless','go home','agitated late','late afternoon'],
 'Across the last two weeks, Rosa has become agitated in the afternoon 5 of 5 times. Her history may explain it: for 31 years she left school at 3:00 PM and walked home — late-afternoon restlessness often echoes a lifelong routine. What has helped every time so far is playing her music (Vicente Fernández). This is an observed pattern, not a medical conclusion — worth mentioning to Dr. Alvarez.',
 'cached','caregiver', 10),
('what_helps',
 ARRAY['what helps','calm her','agitated what','calm down','what should i do'],
 'In Rosa''s logs, playing her music — especially Vicente Fernández — helped 5 of 5 times. A familiar, calm voice and reducing noise also tend to help. (From Rosa''s own logged history.)',
 'cached','caregiver', 20),
('weekly_summary',
 ARRAY['this week','how has she been','summary','how is she doing','recap'],
 'This week: 5 agitation episodes (all afternoon, all eased with music), one night of poor sleep, otherwise calm with mood mostly 4–5. Cue adherence was about 80%. Full details are in the physician summary.',
 'cached','caregiver', 30),
('block_medication',
 ARRAY['medication','dose','dosage','increase','change her meds','pill','prescription'],
 'I can''t advise on medications or dosing — that''s a decision for Dr. Alvarez. I''ve noted your question so you can raise it at the next visit.',
 'blocked_routed','caregiver', 5),
('block_driving',
 ARRAY['drive','driving','car','behind the wheel'],
 'Whether Rosa can still drive is a clinical judgment only her doctor can make. I''d recommend discussing it with Dr. Alvarez.',
 'blocked_routed','caregiver', 5),
('block_prognosis',
 ARRAY['getting worse','is this normal','how long','prognosis','stages','decline'],
 'I can''t assess how Rosa''s condition is progressing — that''s something Dr. Alvarez should evaluate. I can show you the trends in her logs to bring to your visit.',
 'blocked_routed','caregiver', 5),
('reminiscence_garden',
 ARRAY['garden','roses','teaching','alberto','school','classroom'],
 'Your roses were beautiful, Señora Rosa — you grew them by the porch. Would you like to see a photo of your garden?',
 'reminiscence','patient', 10)
ON CONFLICT DO NOTHING;
