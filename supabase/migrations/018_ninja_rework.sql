-- Live feedback from the actual end user: give the Ninja roster real
-- bodies with distinct poses instead of a floating head-blob, and
-- restrain the palette to blue/red/black families ("don't make any
-- crazy colors"). Same 8 characters, same names/flavor text - only
-- the design jsonb changes (pose + color + accent).
-- Pairs on each of the 4 pose templates (components/CharacterAvatar.tsx):
-- action, throw, ready, sneak - 2 characters per pose.

update public.characters set design = '{"shape":"ninja","pose":"action","color":"#0ea5e9","accent":"#ffffff"}'
  where season_slug = 'ninja' and name = 'Kai Shadowleap';

update public.characters set design = '{"shape":"ninja","pose":"throw","color":"#dc2626","accent":"#1a1a2e"}'
  where season_slug = 'ninja' and name = 'Hana Stormfist';

update public.characters set design = '{"shape":"ninja","pose":"ready","color":"#1e3a8a","accent":"#dc2626"}'
  where season_slug = 'ninja' and name = 'Ren Ironwill';

update public.characters set design = '{"shape":"ninja","pose":"sneak","color":"#27272a","accent":"#0ea5e9"}'
  where season_slug = 'ninja' and name = 'Yumi Windwhisper';

update public.characters set design = '{"shape":"ninja","pose":"action","color":"#b91c1c","accent":"#1a1a2e"}'
  where season_slug = 'ninja' and name = 'Bo Thunderstep';

update public.characters set design = '{"shape":"ninja","pose":"ready","color":"#3b82f6","accent":"#ffffff"}'
  where season_slug = 'ninja' and name = 'Miko Frostblade';

update public.characters set design = '{"shape":"ninja","pose":"throw","color":"#991b1b","accent":"#27272a"}'
  where season_slug = 'ninja' and name = 'Taro Emberfang';

update public.characters set design = '{"shape":"ninja","pose":"sneak","color":"#18181b","accent":"#3b82f6"}'
  where season_slug = 'ninja' and name = 'Sora Nightveil';
