-- Admin RPCs for the /admin usage page.
-- Run in Supabase SQL Editor after 001_initial.sql.

-- ── Sessions per day (last 14 days) ─────────────────────────────────────────
create or replace function public.admin_sessions_per_day()
returns table(day text, started bigint, completed bigint)
language sql security definer as $$
  select
    to_char(date_trunc('day', started_at at time zone 'America/New_York'), 'Mon DD') as day,
    count(*)                                                                          as started,
    count(*) filter (where status = 'completed')                                      as completed
  from public.sessions
  where started_at >= now() - interval '14 days'
  group by date_trunc('day', started_at at time zone 'America/New_York')
  order by date_trunc('day', started_at at time zone 'America/New_York') desc;
$$;

-- ── First-attempt accuracy by skill ─────────────────────────────────────────
create or replace function public.admin_accuracy_by_skill()
returns table(name text, attempts bigint, first_correct bigint, accuracy int)
language sql security definer as $$
  select
    sk.name,
    count(sa.id)                                                  as attempts,
    count(sa.id) filter (where sa.was_correct and sa.attempt_number = 1) as first_correct,
    case when count(sa.id) = 0 then 0
         else round(
           count(sa.id) filter (where sa.was_correct and sa.attempt_number = 1)::numeric
           / count(sa.id) * 100
         )::int
    end                                                           as accuracy
  from public.skills sk
  left join public.session_questions sq on sq.skill_id = sk.id
  left join public.session_answers   sa on sa.session_question_id = sq.id
                                        and sa.attempt_number = 1
  where sk.subject = 'math'
  group by sk.id, sk.name, sk.difficulty_order
  order by sk.difficulty_order;
$$;
