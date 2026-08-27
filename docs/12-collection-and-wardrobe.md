# Collection and Wardrobe

Two separate reward systems sit on top of the core practice loop. Both exist
to give a 4th grader a reason to keep opening the app beyond XP and streaks.
They are deliberately kept as two independent systems rather than merged,
per direct feedback from the actual user (see "Why two systems" below).

## 1. Character Collection (`/collection`, "Characters" tab)

Whole-character unlocks, organized into switchable themed "seasons." A
student picks an active season and opens chests to fill out that season's
roster.

**Seasons (`character_seasons` table):**

| Season | Status |
|---|---|
| Ninja Squad 🥷 | Live — 8 characters, fully seeded |
| Hero Roster 🦸 | Empty — shows "coming soon," no characters yet |
| Vehicle Garage 🚀 | Empty — shows "coming soon," no characters yet |

**Ninja Squad roster** (`characters` table) — every character is original
writing/art, not licensed IP. Naruto, Marvel, DC/Justice League, Pokémon,
and similar were explicitly ruled out given LearnLoop's stated
tutor/learning-center go-to-market (real trademark/copyright exposure).
Bodies are a parametric SVG (`components/CharacterAvatar.tsx`) — 4 reusable
pose templates (`ready`, `action`, `throw`, `sneak`), palette restrained to
blue/red/black families per feedback ("don't make any crazy colors"):

| Character | Pose | Rarity |
|---|---|---|
| Kai Shadowleap | action | rare |
| Hana Stormfist | throw | common |
| Ren Ironwill | ready | common |
| Yumi Windwhisper | sneak | rare |
| Bo Thunderstep | action | common |
| Miko Frostblade | ready | epic |
| Taro Emberfang | throw | common |
| Sora Nightveil | sneak | epic |

**Earning chests:** cumulative learning time, not daily. 1 chest per 20
minutes of total practice (`total_learning_seconds()` RPC, derived from
`sessions.started_at`/`completed_at`, each session capped at 20 min so an
abandoned-then-resumed session can't inflate the count). No daily reset —
chests bank up. Opening a chest gives a random unowned character from the
active season, weighted toward whatever's left; once the whole season is
owned, a chest instead gives a small XP bonus.

**Character Customizer ("Your Creations" shelf):** a student can build
their own character — pick a color, a pose (same 4 templates), and a name.
Stored in `custom_characters`, personal to that student. Always visible,
never chest-gated or season-scoped — making one *is* the reward.

## 2. Wardrobe (`/collection`, "Avatar" tab)

A separate, Roblox-style system: one blocky layered avatar per student,
dressed in owned shirts/pants/accessories bought or won individually,
rather than unlocking whole pre-made characters.

**Avatar rendering** (`components/AvatarView.tsx`): fixed base body
(head/torso/arms/legs), with equipped items layered on top by slot.

**Starter catalog** (`wardrobe_items`, 11 items):

| Slot | Item | Rarity | Price |
|---|---|---|---|
| Shirt | Red Tee | common | 20 |
| Shirt | Blue Hoodie | common | 20 |
| Shirt | Green Stripe | rare | 60 |
| Shirt | Galaxy Jacket | epic | 150 |
| Pants | Black Jeans | common | 20 |
| Pants | Gray Sweats | common | 20 |
| Pants | Camo Cargo | rare | 60 |
| Pants | Lava Pants | epic | 150 |
| Accessory | Baseball Cap | common | 25 |
| Accessory | Sunglasses | rare | 70 |
| Accessory | Golden Crown | legendary | 300 |

**Coins** — a currency separate from XP, earned two ways:

1. **Every completed practice session**, scaled by performance
   (`lib/coins.ts`): 5 base, +8 if every question was right on the first
   try (+4 if ≥80% right), +4 if the average time per question was ≤20s
   (+2 if ≤35s). Rewards accuracy *and* speed, unlike flat-rate XP.
2. **The daily wardrobe chest** (below) — a random item, or once the whole
   catalog is owned, a flat coin bonus instead.

**Daily chest:** unlocks once per calendar day, after 30 minutes of
practice *that day* — a different gate than the character system's
cumulative-time chest. Rarity odds when a chest hits an item:
common 50% / rare 30% / epic 15% / legendary 5%, restricted to items not
already owned.

**Shop:** any catalog item can also be bought directly with coins, no
chest needed. Owned items show an "Equip" button instead of a price;
equipping swaps that slot's `equipped_*` column on the student's row.

### Why two systems, not one

Brought up directly with the actual user: keep the Ninja/Hero/Vehicle
character collection exactly as shipped, and add the wardrobe as something
new alongside it, not a replacement. This also means the two chest
mechanics deliberately don't share a pool — practicing 30 minutes in a day
can make both a wardrobe chest *and* character chests available at once,
independently.

## Data model added by these two systems

- `character_seasons`, `characters`, `user_characters`, `custom_characters`
- `wardrobe_items`, `user_wardrobe_items`
- `users` gained: `current_season`, `chests_opened_count`, `coins`,
  `equipped_shirt`/`equipped_pants`/`equipped_accessory`,
  `last_wardrobe_chest_date`
- RPCs: `total_learning_seconds`, `today_practice_seconds`,
  `increment_coins`, `wardrobe_chest_available`,
  `mark_wardrobe_chest_opened` (all `security definer`, mirroring the
  existing `increment_xp`/`update_streak` pattern)

## Planned, not yet built

**Hero Roster and Vehicle Garage rosters.** Both seasons exist in the
schema and show "coming soon" — they need their own original-IP character
sets, same treatment as Ninja Squad (no licensed characters).

**Wardrobe follow-ups**, raised but explicitly deferred:
- Preview an item on the avatar before buying it (shop currently shows a
  flat color swatch, not the equipped look).
- Some form of duplicate/re-roll protection or pity mechanic beyond plain
  ownership dedup, if the 11-item catalog turns out too small once a
  student is closer to owning everything.
- More catalog variety generally — 11 items is a deliberately small MVP
  seed, not a target size.

**Diagnostic → adaptive workout plan** (separate curriculum feature, not a
reward-system item, but the next planned build after this doc's scope):
a 50-question diagnostic per subject (math and English separately) that
seeds a workout plan of 3 skills rotating in lockstep — every skill
advances through tier 1 together, then tier 2 together, and so on. Acing
every question in a level, including its hard checkpoint, skips the whole
rotation ahead a level. A second diagnostic after the plan completes
measures improvement. This needs its own dedicated planning pass (new
plan-state schema, tier progression synchronized across 3 skills instead
of independent per skill) — deliberately not rushed into this pass.
