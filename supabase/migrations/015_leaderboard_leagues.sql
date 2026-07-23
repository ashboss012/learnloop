-- Leaderboard leagues: promotion-only (top 3 in the weekly board advances
-- a league), no demotion - matches the app's established "no punishment"
-- philosophy (docs/08's ADHD notes) and what was actually asked for.
-- Evaluated on-demand the first time the leaderboard loads after a new
-- week starts (league_week_start marks the last evaluated week), not a
-- cron job - same "no fancy scheduling" approach as the bots themselves.

alter table public.users
  add column current_league int not null default 1 check (current_league between 1 and 5),
  add column league_week_start date;
