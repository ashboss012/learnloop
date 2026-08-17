-- Character collection: chests earned from cumulative learning time,
-- opened to unlock original characters organized into switchable
-- "seasons" (themed rosters) the student picks between. Every
-- character here is original art/writing - no licensed IP (see
-- AGENTS.md's "Never build these" for why that matters given
-- LearnLoop's stated tutor/learning-center go-to-market).

-- ─── character_seasons ──────────────────────────────────────────────────────
create table public.character_seasons (
  slug        text primary key,
  name        text not null,
  icon        text not null,
  sort_order  int not null default 0
);

alter table public.character_seasons enable row level security;

create policy "character_seasons: anyone reads" on public.character_seasons
  for select using (true);

-- ─── characters ──────────────────────────────────────────────────────────────
-- `design` holds simple render parameters (shape/color/accent), not an
-- image asset - components/CharacterAvatar.tsx renders these as a
-- parametric SVG, same trust model as components/Mascot.tsx.
create table public.characters (
  id           uuid primary key default uuid_generate_v4(),
  season_slug  text not null references public.character_seasons(slug),
  name         text not null,
  flavor_text  text not null,
  rarity       text not null default 'common' check (rarity in ('common', 'rare', 'epic')),
  design       jsonb not null,
  sort_order   int not null default 0
);

alter table public.characters enable row level security;

create policy "characters: anyone reads" on public.characters
  for select using (true);

-- ─── user_characters ─────────────────────────────────────────────────────────
-- A student's unlocked collection - also doubles as the "already own
-- this one" dedup check when a chest is opened. No update policy: once
-- unlocked, a character stays unlocked, nothing here ever changes.
create table public.user_characters (
  user_id       uuid not null references public.users(id) on delete cascade,
  character_id  uuid not null references public.characters(id),
  unlocked_at   timestamptz not null default now(),
  primary key (user_id, character_id)
);

alter table public.user_characters enable row level security;

create policy "user_characters: read own" on public.user_characters
  for select using (auth.uid() = user_id);

create policy "user_characters: insert own" on public.user_characters
  for insert with check (auth.uid() = user_id);

-- ─── users: season selection + opened-chest counter ─────────────────────────
alter table public.users
  add column current_season text references public.character_seasons(slug),
  add column chests_opened_count int not null default 0;

-- ─── total_learning_seconds ──────────────────────────────────────────────────
-- Cumulative learning time, derived from sessions.started_at/completed_at
-- rather than tracked live - covers every session-completion code path
-- (completeSession, resolveSkipCheckpoint in app/actions/session.ts,
-- completeDiagnostic in app/actions/diagnostic.ts) automatically, since
-- they all write to this same table. least() caps any single session's
-- contribution at 20 minutes so an abandoned-then-resumed session can't
-- inflate the total. Chest math (app/actions/characters.ts) is
-- floor(total_learning_seconds / 1200) - users.chests_opened_count.
create or replace function public.total_learning_seconds(uid uuid)
returns int
language sql security definer as $$
  select coalesce(sum(
    extract(epoch from least(completed_at - started_at, interval '20 minutes'))
  ), 0)::int
  from public.sessions
  where user_id = uid and status = 'completed' and completed_at is not null;
$$;

-- ─── seed: seasons ────────────────────────────────────────────────────────────
insert into public.character_seasons (slug, name, icon, sort_order) values
  ('ninja', 'Ninja Squad', '🥷', 1),
  ('hero', 'Hero Roster', '🦸', 2),
  ('vehicles', 'Vehicle Garage', '🚀', 3);

-- ─── seed: Ninja roster (MVP season, 8 characters) ──────────────────────────
insert into public.characters (season_slug, name, flavor_text, rarity, design, sort_order) values
  ('ninja', 'Kai Shadowleap', 'Fastest scout in the squad - blink and he''s already gone.', 'rare', '{"shape":"ninja","color":"#6c63ff","accent":"#f59e0b"}', 1),
  ('ninja', 'Hana Stormfist', 'Hits like thunder. Ask anyone who''s sparred her.', 'common', '{"shape":"ninja","color":"#ef4444","accent":"#1a1a2e"}', 2),
  ('ninja', 'Ren Ironwill', 'Never backs down, never gives up.', 'common', '{"shape":"ninja","color":"#22c55e","accent":"#f97316"}', 3),
  ('ninja', 'Yumi Windwhisper', 'So quiet you won''t know she was there until she''s gone.', 'rare', '{"shape":"ninja","color":"#0ea5e9","accent":"#8b5cf6"}', 4),
  ('ninja', 'Bo Thunderstep', 'Loud, energetic, and impossible to ignore.', 'common', '{"shape":"ninja","color":"#f59e0b","accent":"#ec4899"}', 5),
  ('ninja', 'Miko Frostblade', 'Cool under pressure. Always three steps ahead.', 'epic', '{"shape":"ninja","color":"#06b6d4","accent":"#ffffff"}', 6),
  ('ninja', 'Taro Emberfang', 'Fights with fire in his eyes and his fists.', 'common', '{"shape":"ninja","color":"#f97316","accent":"#dc2626"}', 7),
  ('ninja', 'Sora Nightveil', 'Master of stealth - a shadow among shadows.', 'epic', '{"shape":"ninja","color":"#8b5cf6","accent":"#1a1a2e"}', 8);
