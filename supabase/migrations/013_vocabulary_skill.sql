-- Vocabulary: the third English content pillar from docs/03 (grammar and
-- reading comprehension are the other two). Rule-based like grammar - a
-- hand-authored word bank in lib/english/generator.ts, no LLM needed.

insert into public.skills (subject, name, slug, difficulty_order) values
  ('english', 'Vocabulary', 'english-vocabulary', 20);
