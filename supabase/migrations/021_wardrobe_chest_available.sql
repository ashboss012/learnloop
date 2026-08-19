-- Whether the wardrobe daily chest is currently openable. Kept fully
-- server-side (like update_streak's day-boundary logic in 001) rather than
-- comparing users.last_wardrobe_chest_date to a JS-computed "today" string,
-- which would risk drifting from Postgres's current_date if timezones ever
-- disagree.
create or replace function public.wardrobe_chest_available(uid uuid)
returns boolean
language sql security definer as $$
  select public.today_practice_seconds(uid) >= 1800
    and exists (
      select 1 from public.users
      where id = uid and (last_wardrobe_chest_date is null or last_wardrobe_chest_date < current_date)
    );
$$;
