-- Widen the adaptive tier scale from 1-3 to 1-5, so students beyond the
-- old grade-5-and-up ceiling actually get differentiated difficulty
-- instead of all landing on the same max tier. The old check constraint
-- (004_user_skill_progress.sql) hardcoded 1-3 - without this migration
-- every tier-4/5 write from the widened code would fail.

alter table public.user_skill_progress
  drop constraint user_skill_progress_tier_check;

alter table public.user_skill_progress
  add constraint user_skill_progress_tier_check check (tier between 1 and 5);

-- New skill: multi-step word problems (docs/02's one remaining "Not in
-- v1" math item), built on the wider tier scale from day one.
insert into public.skills (subject, name, slug, difficulty_order) values
  ('math', 'Word Problems', 'math-word-problems', 13);
