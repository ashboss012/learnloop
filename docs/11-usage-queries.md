# 11. Usage Queries

Paste these into the Supabase SQL Editor to inspect real data.
The admin page at /admin runs equivalent RPCs automatically.

## Sessions per day (last 14 days)

```sql
select
  to_char(date_trunc('day', started_at at time zone 'America/New_York'), 'Mon DD') as day,
  count(*)                                                 as started,
  count(*) filter (where status = 'completed')             as completed,
  round(
    count(*) filter (where status = 'completed')::numeric
    / nullif(count(*), 0) * 100
  ) || '%'                                                 as finish_rate
from public.sessions
where started_at >= now() - interval '14 days'
group by date_trunc('day', started_at at time zone 'America/New_York')
order by 1 desc;
```

## First-attempt accuracy by skill

```sql
select
  sk.name,
  count(sa.id)                                                           as total_attempts,
  count(sa.id) filter (where sa.was_correct and sa.attempt_number = 1)  as first_try_correct,
  round(
    count(sa.id) filter (where sa.was_correct and sa.attempt_number = 1)::numeric
    / nullif(count(sa.id), 0) * 100
  ) || '%'                                                               as accuracy
from public.skills sk
left join public.session_questions sq on sq.skill_id = sk.id
left join public.session_answers   sa on sa.session_question_id = sq.id
                                      and sa.attempt_number = 1
where sk.subject = 'math'
group by sk.id, sk.name, sk.difficulty_order
order by sk.difficulty_order;
```

## Streak history per student

```sql
select
  u.display_name,
  s.current_streak,
  s.longest_streak,
  s.last_active_date,
  s.freezes_available
from public.streaks s
join public.users u on u.id = s.user_id
order by s.current_streak desc;
```

## Overall student stats

```sql
select
  u.display_name,
  u.xp_total,
  st.current_streak,
  count(se.id) filter (where se.status = 'completed') as sessions_completed,
  count(se.id) filter (where se.status = 'active')    as sessions_abandoned,
  min(se.started_at)::date                            as first_session,
  max(se.started_at)::date                            as last_session
from public.users u
left join public.streaks  st on st.user_id = u.id
left join public.sessions se on se.user_id = u.id
where u.role = 'student'
group by u.id, u.display_name, u.xp_total, st.current_streak
order by u.xp_total desc;
```
