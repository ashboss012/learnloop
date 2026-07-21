-- 3-day activity check-in: a dashboard card surfaced once every 3+ days
-- summarizing recent practice (sessions, questions, accuracy per skill,
-- current level) - an activity recap, not a tier-history diff, so no
-- other schema is needed beyond remembering when it was last shown.

alter table public.users
  add column last_checkin_at timestamptz;
