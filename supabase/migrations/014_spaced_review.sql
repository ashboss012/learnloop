-- Phase 5, first signal from docs/08: spaced review. A skill that was
-- missed recently should resurface sooner than one just aced - a
-- dashboard-level nudge (badge + sort), not a session-mechanics change,
-- per docs/08's ADHD notes (protect short/simple sessions, don't override
-- them). No new theory beyond what's already stored per-session.

alter table public.user_skill_progress
  add column last_practiced_at timestamptz,
  add column due_for_review_at date;
