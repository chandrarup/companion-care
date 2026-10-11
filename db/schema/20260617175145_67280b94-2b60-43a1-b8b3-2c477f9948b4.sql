
INSERT INTO public.training_content (title, body, language, symptom_tag, video_url, source_attribution, action_card_text)
VALUES
  ('Handling repetition','Answer calmly each time as if it''s the first. Redirect to a familiar comfort — a photo, a song, the garden.','en','repetition','https://www.youtube.com/embed/2WS-w9XbtoQ','Alzheimer''s Association — general guidance','Next time: answer once kindly, then redirect to a favorite memory or activity.'),
  ('Better sleep routines','Keep a consistent wind-down, dim lights and screens in the evening, and avoid long afternoon naps.','en','sleep','https://www.youtube.com/embed/2WS-w9XbtoQ','Alzheimer''s Association — general guidance','Next time: start a quiet wind-down 30 minutes before bed and dim the lights.')
ON CONFLICT DO NOTHING;

DELETE FROM public.demo_responses;

INSERT INTO public.demo_responses (label, keywords, answer, tag, mode, priority) VALUES
('block_medication',
  ARRAY['medication','dose','dosage','increase','change her meds','pill','give her more','prescription'],
  'I can''t advise on medications or dosing — that''s for Dr. Alvarez to decide. I''ve noted your question so you can raise it at the next visit.',
  'blocked_routed','caregiver', 1),
('block_driving',
  ARRAY['drive','driving','car','behind the wheel'],
  'Whether Rosa can still drive is a clinical judgment only her doctor can make. I''d raise it with Dr. Alvarez.',
  'blocked_routed','caregiver', 1),
('block_prognosis',
  ARRAY['getting worse','is this normal','how long','prognosis','what stage','dying','decline'],
  'I can''t assess how Rosa''s condition is progressing — that''s for Dr. Alvarez to evaluate. I can show you the trends in her logs to bring to your visit.',
  'blocked_routed','caregiver', 1),
('afternoon_insight',
  ARRAY['afternoon','3pm','3 pm','restless','go home','evening agitated','why does she'],
  'Rosa has gotten agitated in the late afternoon 5 of 5 times this period. Her history likely explains it — she taught school for 31 years and walked home at 3:00 every day, so late-afternoon restlessness often echoes that old routine. Playing her Vicente Fernández music has helped every time. Worth mentioning to Dr. Alvarez.',
  'cached','caregiver', 10),
('what_to_do_now',
  ARRAY['what do i do','calm her','she''s agitated','agitated now','help her calm'],
  'Try her music first — Vicente Fernández has worked 5 of 5 times for Rosa. Lower the noise, dim bright lights, and sit with her calmly rather than correcting her. Here''s a 2-minute video on gently easing agitation.',
  'cached','caregiver', 15),
('repetition',
  ARRAY['repeat','repeating','asks again','same question','over and over'],
  'Repetition is the dementia, not Rosa being difficult — answer calmly each time as if it''s the first. Try redirecting to something she loves, like her rose garden or a photo. Short video on handling repetition below.',
  'cached','caregiver', 20),
('appetite',
  ARRAY['eat','eating','appetite','won''t eat','not hungry','meals'],
  'Rosa''s logs show appetite changes in the afternoon. Try offering small portions of familiar favorites, eating together, and keeping mealtimes on her usual routine. If it continues several days, note it for Dr. Alvarez.',
  'cached','caregiver', 25),
('sleep',
  ARRAY['sleep','can''t sleep','night','awake','waking','restless night'],
  'Rosa had one poor-sleep night logged on June 8. Keep a consistent wind-down, dim screens and lights in the evening, and avoid afternoon naps if possible. Bring the sleep trend to the next visit. Short video on better sleep routines below.',
  'cached','caregiver', 25),
('weekly_summary',
  ARRAY['how has she been','this week','summary','how is she doing'],
  'This period: agitation 5 times (all afternoon, all eased with music), one poor-sleep night, otherwise calm with good mood. Cue adherence about 80%. The full picture is in the Summary tab.',
  'cached','caregiver', 30),
('what_helps',
  ARRAY['what helps','what works','what calms','best for her'],
  'For Rosa specifically: her Vicente Fernández music (helped 5 of 5 times), looking at her rose-garden and family photos, and keeping her gentle daily routine. Calm voice and lower noise help most.',
  'cached','caregiver', 35),
('reminiscence_garden',
  ARRAY['garden','roses','teaching','school','alberto','music','children'],
  'Your rose garden was beautiful, Rosa — you grew them right by the porch. Would you like to see a photo, or hear some of your music?',
  'reminiscence','patient', 10);
