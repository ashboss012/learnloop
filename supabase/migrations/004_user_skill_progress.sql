-- Adaptive difficulty: tracks each student's current tier (1-3) per skill.
--
-- Seeded from grade on first use (lib/mastery.ts), then stepped +-1 after
-- every primary-pass question based on first-attempt correctness
-- (app/actions/session.ts getNextQuestion). Mirrors the streaks table's
-- RLS pattern below.

create table public.user_skill_progress (
  user_id     uuid not null references public.users(id) on delete cascade,
  skill_id    uuid not null references public.skills(id) on delete cascade,
  tier        int not null default 1 check (tier between 1 and 3),
  updated_at  timestamptz not null default now(),
  primary key (user_id, skill_id)
);

alter table public.user_skill_progress enable row level security;

create policy "user_skill_progress: read own" on public.user_skill_progress
  for select using (auth.uid() = user_id);

create policy "user_skill_progress: upsert own" on public.user_skill_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
