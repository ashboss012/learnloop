-- Roblox-style wardrobe: a separate, additional collection system living
-- alongside the Ninja/Hero/Vehicle characters (migrations 017-019, left
-- untouched). Shirts/pants/accessories of varying rarity, bought with
-- coins or won from a once-per-day chest gated on 30 minutes of practice
-- that calendar day (not the character system's cumulative-time chest).

-- ─── wardrobe_items ──────────────────────────────────────────────────────────
-- `design` holds simple render params (color/accent/pattern/kind), not an
-- image asset - components/AvatarView.tsx renders these as a parametric
-- SVG layer, same trust model as components/CharacterAvatar.tsx.
create table public.wardrobe_items (
  id          uuid primary key default uuid_generate_v4(),
  slot        text not null check (slot in ('shirt', 'pants', 'accessory')),
  name        text not null,
  rarity      text not null default 'common' check (rarity in ('common', 'rare', 'epic', 'legendary')),
  design      jsonb not null,
  coin_price  int not null,
  sort_order  int not null default 0
);

alter table public.wardrobe_items enable row level security;

create policy "wardrobe_items: anyone reads" on public.wardrobe_items
  for select using (true);

-- ─── user_wardrobe_items ─────────────────────────────────────────────────────
-- Owned items - also the "already own this" dedup check when a chest is
-- opened or an item is bought. No update policy: ownership never changes
-- once granted.
create table public.user_wardrobe_items (
  user_id     uuid not null references public.users(id) on delete cascade,
  item_id     uuid not null references public.wardrobe_items(id),
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table public.user_wardrobe_items enable row level security;

create policy "user_wardrobe_items: read own" on public.user_wardrobe_items
  for select using (auth.uid() = user_id);

create policy "user_wardrobe_items: insert own" on public.user_wardrobe_items
  for insert with check (auth.uid() = user_id);

-- ─── users: coins, equipped items, daily-chest gate ─────────────────────────
alter table public.users
  add column coins int not null default 0,
  add column equipped_shirt uuid references public.wardrobe_items(id),
  add column equipped_pants uuid references public.wardrobe_items(id),
  add column equipped_accessory uuid references public.wardrobe_items(id),
  add column last_wardrobe_chest_date date;

-- ─── increment_coins ─────────────────────────────────────────────────────────
create or replace function public.increment_coins(uid uuid, amount int)
returns void language plpgsql security definer as $$
begin
  update public.users set coins = coins + amount where id = uid;
end;
$$;

-- ─── today_practice_seconds ──────────────────────────────────────────────────
-- Same shape as total_learning_seconds (017), same per-session 20-minute
-- cap, but scoped to the current calendar day - the wardrobe chest's daily
-- gate is 30 min practiced *today*, not cumulative lifetime. `current_date`
-- matches update_streak's (001) day-boundary convention.
create or replace function public.today_practice_seconds(uid uuid)
returns int
language sql security definer as $$
  select coalesce(sum(
    extract(epoch from least(completed_at - started_at, interval '20 minutes'))
  ), 0)::int
  from public.sessions
  where user_id = uid and status = 'completed' and completed_at is not null
    and completed_at::date = current_date;
$$;

-- ─── seed: starter catalog ────────────────────────────────────────────────────
insert into public.wardrobe_items (slot, name, rarity, design, coin_price, sort_order) values
  ('shirt', 'Red Tee',        'common',    '{"color":"#ef4444"}', 20, 1),
  ('shirt', 'Blue Hoodie',    'common',    '{"color":"#3b82f6"}', 20, 2),
  ('shirt', 'Green Stripe',   'rare',      '{"color":"#22c55e","accent":"#ffffff","pattern":"stripe"}', 60, 3),
  ('shirt', 'Galaxy Jacket',  'epic',      '{"color":"#7c3aed","accent":"#fbbf24","pattern":"stripe"}', 150, 4),

  ('pants', 'Black Jeans',    'common',    '{"color":"#27272a"}', 20, 1),
  ('pants', 'Gray Sweats',    'common',    '{"color":"#6b7280"}', 20, 2),
  ('pants', 'Camo Cargo',     'rare',      '{"color":"#4d7c0f","accent":"#365314","pattern":"stripe"}', 60, 3),
  ('pants', 'Lava Pants',     'epic',      '{"color":"#dc2626","accent":"#f59e0b","pattern":"stripe"}', 150, 4),

  ('accessory', 'Baseball Cap', 'common',    '{"kind":"hat","color":"#3b82f6"}', 25, 1),
  ('accessory', 'Sunglasses',   'rare',      '{"kind":"glasses","color":"#18181b"}', 70, 2),
  ('accessory', 'Golden Crown', 'legendary', '{"kind":"hat","color":"#fbbf24"}', 300, 3);
