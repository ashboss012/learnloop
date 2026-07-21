-- Every account gets a real, distinct name - never the generic "Friend"
-- placeholder. Anonymous sign-in has no email or display_name metadata
-- to fall back to, so the old trigger always landed on the same static
-- "Friend" string for every anonymous user, which reads as duplicate
-- entries once names are shown together (e.g. the leaderboard).

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  fallback_names text[] := array['Sunny','Ace','Milo','Luna','Rex','Jade','Finn','Skye','Dash','Wren'];
begin
  insert into public.users (id, display_name, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1),
      fallback_names[floor(random() * array_length(fallback_names, 1) + 1)::int]
    ),
    coalesce(new.raw_user_meta_data->>'role', 'student')
  );
  insert into public.streaks (user_id) values (new.id);
  return new;
end;
$$;

-- Retroactively rename any existing accounts still stuck on the old
-- static "Friend" fallback (e.g. test accounts created before this fix).
update public.users
set display_name = (array['Sunny','Ace','Milo','Luna','Rex','Jade','Finn','Skye','Dash','Wren'])[floor(random() * 10 + 1)::int]
where display_name = 'Friend';
