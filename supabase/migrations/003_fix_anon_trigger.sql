-- Fix handle_new_user so anonymous sign-in works.
--
-- The original trigger used coalesce(display_name_meta, split_part(email, '@', 1)).
-- For anonymous users both values are NULL, which violated the NOT NULL constraint
-- on users.display_name and caused signInAnonymously() to silently fail.
-- Adding 'Friend' as a final fallback makes the trigger safe for anonymous users.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, display_name, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1),
      'Friend'
    ),
    coalesce(new.raw_user_meta_data->>'role', 'student')
  );
  insert into public.streaks (user_id) values (new.id);
  return new;
end;
$$;
