-- Phase 2, first slice: grammar (English subject). Rule-based and
-- verifiable like math (docs/03-content-english.md), generated on-demand
-- from hand-authored word/sentence banks in lib/english/generator.ts.
-- No schema change needed - skills.subject is free-text, no CHECK
-- constraint restricting it to 'math'.

insert into public.skills (subject, name, slug, difficulty_order) values
  ('english', 'Parts of Speech',        'english-parts-of-speech',        13),
  ('english', 'Subject-Verb Agreement', 'english-subject-verb-agreement', 14),
  ('english', 'Tenses',                 'english-tenses',                 15),
  ('english', 'Punctuation',            'english-punctuation',            16),
  ('english', 'Capitalization',         'english-capitalization',         17),
  ('english', 'Plurals',                'english-plurals',                18);
