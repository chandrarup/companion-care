
ALTER TABLE public.cues
  ADD COLUMN IF NOT EXISTS cue_type text NOT NULL DEFAULT 'custom'
    CHECK (cue_type IN ('hydration','medication','appointment','custom')),
  ADD COLUMN IF NOT EXISTS schedule_times text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS days_of_week integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

ALTER TABLE public.cue_events
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

ALTER TABLE public.training_content
  ADD COLUMN IF NOT EXISTS symptom_tag text,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS source_attribution text,
  ADD COLUMN IF NOT EXISTS action_card_text text;

CREATE INDEX IF NOT EXISTS training_content_symptom_lang_idx
  ON public.training_content (symptom_tag, language) WHERE deleted_at IS NULL;

ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS notify_window_start time NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS notify_window_end time NOT NULL DEFAULT '20:00';

-- Seed a small set of training rows (en) for the symptoms used in the app.
INSERT INTO public.training_content (title, body, language, symptom_tag, video_url, source_attribution, action_card_text)
VALUES
  ('Lowering overstimulation','Reduce light, sound, and visitors. Move to a quieter space.','en','overstimulation','https://www.youtube.com/embed/2WS-w9XbtoQ','Alzheimer''s Association — general guidance','Next time: dim lights, lower noise, take them to a calm room.'),
  ('Easing agitation','Stay calm, speak slowly, validate feelings, and offer a familiar activity.','en','agitation','https://www.youtube.com/embed/2WS-w9XbtoQ','Alzheimer''s Association — general guidance','Next time: lower your voice, sit beside them, offer a comforting object.'),
  ('Handling confusion','Use short sentences, point to familiar items, and avoid arguing about facts.','en','confusion','https://www.youtube.com/embed/2WS-w9XbtoQ','Alzheimer''s Association — general guidance','Next time: orient gently with one short sentence and a familiar object.'),
  ('Wandering safety','Make sure exits are secured and they wear ID. Redirect with a familiar activity.','en','wandering','https://www.youtube.com/embed/2WS-w9XbtoQ','Alzheimer''s Association — general guidance','Next time: redirect with a walk or familiar task instead of stopping them.'),
  ('Encouraging hydration','Offer small, frequent sips of preferred drinks; flavored water can help.','en','appetite_change','https://www.youtube.com/embed/2WS-w9XbtoQ','Alzheimer''s Association — general guidance','Next time: offer a small drink they like every hour.')
ON CONFLICT DO NOTHING;
