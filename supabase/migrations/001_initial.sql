-- Phase 0: Core schema for learnloop
-- Run this in Supabase SQL editor after creating your project

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── users ───────────────────────────────────────────────────────────────────
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  grade       int not null default 4,
  role        text not null default 'student' check (role in ('student', 'admin')),
  xp_total    int not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.users enable row level security;

-- Students see only themselves; admin sees all
create policy "users: read own" on public.users
  for select using (auth.uid() = id);

create policy "users: update own" on public.users
  for update using (auth.uid() = id);

create policy "users: insert own" on public.users
  for insert with check (auth.uid() = id);

-- ─── skills ──────────────────────────────────────────────────────────────────
create table public.skills (
  id              uuid primary key default uuid_generate_v4(),
  subject         text not null default 'math',
  name            text not null,
  slug            text not null unique,
  parent_id       uuid references public.skills(id),
  difficulty_order int not null default 0
);

alter table public.skills enable row level security;

create policy "skills: anyone reads" on public.skills
  for select using (true);

-- ─── session_questions ───────────────────────────────────────────────────────
-- Stores server-generated parametric questions. Answer is NEVER sent to client.
create table public.session_questions (
  id            uuid primary key default uuid_generate_v4(),
  session_id    uuid not null,  -- FK added below after sessions table
  skill_id      uuid not null references public.skills(id),
  prompt        text not null,
  choices       jsonb,           -- [{label, value}] for multiple choice
  answer        text not null,   -- NEVER exposed to client via RLS
  explanation   text not null,
  difficulty    int not null default 1,
  position      int not null,    -- original position in the session queue
  created_at    timestamptz not null default now()
);

-- ─── sessions ────────────────────────────────────────────────────────────────
create table public.sessions (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.users(id) on delete cascade,
  skill_id      uuid not null references public.skills(id),
  subject       text not null default 'math',
  status        text not null default 'active' check (status in ('active','completed')),
  xp_earned     int not null default 0,
  question_count int not null default 8,
  started_at    timestamptz not null default now(),
  completed_at  timestamptz
);

alter table public.sessions enable row level security;

create policy "sessions: read own" on public.sessions
  for select using (auth.uid() = user_id);

create policy "sessions: insert own" on public.sessions
  for insert with check (auth.uid() = user_id);

create policy "sessions: update own" on public.sessions
  for update using (auth.uid() = user_id);

-- Add FK on session_questions now that sessions exists
alter table public.session_questions
  add constraint session_questions_session_id_fkey
  foreign key (session_id) references public.sessions(id) on delete cascade;

alter table public.session_questions enable row level security;

-- Students can see their own session questions but NOT the answer column
-- We expose a view without the answer column
create policy "session_questions: read own (no answer)" on public.session_questions
  for select using (
    session_id in (
      select id from public.sessions where user_id = auth.uid()
    )
  );

create policy "session_questions: insert own" on public.session_questions
  for insert with check (
    session_id in (
      select id from public.sessions where user_id = auth.uid()
    )
  );

-- ─── session_answers ─────────────────────────────────────────────────────────
create table public.session_answers (
  id                  uuid primary key default uuid_generate_v4(),
  session_id          uuid not null references public.sessions(id) on delete cascade,
  session_question_id uuid not null references public.session_questions(id) on delete cascade,
  chosen              text,        -- what the student selected
  was_correct         boolean not null,
  attempt_number      int not null default 1,
  answered_at         timestamptz not null default now()
);

alter table public.session_answers enable row level security;

create policy "session_answers: read own" on public.session_answers
  for select using (
    session_id in (select id from public.sessions where user_id = auth.uid())
  );

create policy "session_answers: insert own" on public.session_answers
  for insert with check (
    session_id in (select id from public.sessions where user_id = auth.uid())
  );

-- ─── streaks ─────────────────────────────────────────────────────────────────
create table public.streaks (
  user_id           uuid primary key references public.users(id) on delete cascade,
  current_streak    int not null default 0,
  longest_streak    int not null default 0,
  last_active_date  date,
  freezes_available int not null default 2
);

alter table public.streaks enable row level security;

create policy "streaks: read own" on public.streaks
  for select using (auth.uid() = user_id);

create policy "streaks: upsert own" on public.streaks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Seed: Math skill tree ───────────────────────────────────────────────────
insert into public.skills (subject, name, slug, difficulty_order) values
  ('math', 'Multiplication', 'math-multiplication', 1),
  ('math', 'Division',       'math-division',       2),
  ('math', 'Fractions',      'math-fractions',      3),
  ('math', 'Decimals',       'math-decimals',       4);

-- ─── Trigger: auto-create user row + streak on signup ────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'student')
  );
  insert into public.streaks (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── RPCs ─────────────────────────────────────────────────────────────────────

create or replace function public.increment_xp(uid uuid, amount int)
returns void language plpgsql security definer as $$
begin
  update public.users set xp_total = xp_total + amount where id = uid;
end;
$$;

create or replace function public.update_streak(uid uuid)
returns int language plpgsql security definer as $$
declare
  streak_row public.streaks%rowtype;
  today date := current_date;
begin
  select * into streak_row from public.streaks where user_id = uid;

  if streak_row.last_active_date = today then
    -- Already logged today, no change
    return streak_row.current_streak;
  elsif streak_row.last_active_date = today - interval '1 day' then
    -- Consecutive day
    update public.streaks
      set current_streak = current_streak + 1,
          longest_streak = greatest(longest_streak, current_streak + 1),
          last_active_date = today
      where user_id = uid;
    return streak_row.current_streak + 1;
  elsif streak_row.last_active_date = today - interval '2 days'
        and streak_row.freezes_available > 0 then
    -- Use a freeze
    update public.streaks
      set current_streak = current_streak + 1,
          longest_streak = greatest(longest_streak, current_streak + 1),
          last_active_date = today,
          freezes_available = freezes_available - 1
      where user_id = uid;
    return streak_row.current_streak + 1;
  else
    -- Streak broken (or first time)
    update public.streaks
      set current_streak = 1,
          longest_streak = greatest(longest_streak, 1),
          last_active_date = today
      where user_id = uid;
    return 1;
  end if;
end;
$$;
