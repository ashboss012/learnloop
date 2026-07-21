-- Weekly XP aggregation for the leaderboard, scoped to a grade cohort.
-- security definer because a student's own RLS ("sessions/session_answers:
-- read own") can't see a same-grade peer's session data, by design - this
-- exposes only the aggregate (display_name + xp), the same trust model as
-- the existing admin RPCs in 002_admin_rpcs.sql.

create or replace function public.weekly_xp_by_grade(p_grade int, p_week_start date)
returns table(user_id uuid, display_name text, xp int)
language sql security definer as $$
  select
    u.id,
    u.display_name,
    (coalesce(session_xp.total, 0) + coalesce(answer_xp.total, 0))::int as xp
  from public.users u
  left join (
    select s.user_id, count(*) * 50 as total
    from public.sessions s
    where s.status = 'completed' and s.completed_at >= p_week_start
    group by s.user_id
  ) session_xp on session_xp.user_id = u.id
  left join (
    select s.user_id, count(*) * 5 as total
    from public.session_answers sa
    join public.sessions s on s.id = sa.session_id
    where sa.was_correct and sa.attempt_number = 1 and sa.answered_at >= p_week_start
    group by s.user_id
  ) answer_xp on answer_xp.user_id = u.id
  where u.grade = p_grade and u.role = 'student';
$$;
