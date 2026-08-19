-- Stamps last_wardrobe_chest_date using Postgres's current_date, the same
-- source of truth wardrobe_chest_available (021) reads from - avoids any
-- drift against a JS-computed date string.
create or replace function public.mark_wardrobe_chest_opened(uid uuid)
returns void language plpgsql security definer as $$
begin
  update public.users set last_wardrobe_chest_date = current_date where id = uid;
end;
$$;
