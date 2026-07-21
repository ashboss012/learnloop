-- Upfront diagnostic placement test, triggered the first time a student
-- taps any skill card in a subject they haven't been placed in yet.
-- Reuses sessions/session_questions/session_answers as-is (see
-- app/actions/diagnostic.ts) - session_questions.skill_id spans every
-- skill in the subject instead of one skill repeated, which nothing in
-- the existing schema or RLS assumed had to match sessions.skill_id.

alter table public.users
  add column math_diagnostic_done boolean not null default false,
  add column english_diagnostic_done boolean not null default false;

alter table public.sessions
  add column kind text not null default 'practice' check (kind in ('practice', 'diagnostic'));
