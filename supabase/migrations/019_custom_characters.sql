-- Character customizer: a student picks color/pose/name to create their
-- own character. Personal to that student (not a shared unlockable
-- other students could also pull), so this is a separate table from
-- public.characters rather than a row in it - making one IS the
-- reward, no chest/season gating involved.
create table public.custom_characters (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.users(id) on delete cascade,
  name        text not null,
  design      jsonb not null,
  created_at  timestamptz not null default now()
);

alter table public.custom_characters enable row level security;

create policy "custom_characters: read own" on public.custom_characters
  for select using (auth.uid() = user_id);

create policy "custom_characters: insert own" on public.custom_characters
  for insert with check (auth.uid() = user_id);
