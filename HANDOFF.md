# LearnLoop — Handoff

**As of:** 2026-08-20. Branch `master`, latest feature commit `93ac68f`
("Add Roblox-style wardrobe: shirts/pants/accessories, coins, daily
chest"), plus this doc-sync commit on top. Tree is clean once this
commit lands. Deployed and in real use since 2026-07-20.

## Read this first

- **AGENTS.md** → hard rules (the five non-negotiables, "never build
  these"), current shipped state, conventions, definition of done.
  Read its "Current state" section before assuming anything exists or
  doesn't.
- **docs/** → the full product spec, one doc per feature. docs/README.md
  has the index. docs/10-build-plan.md tracks phase status.
  docs/12-collection-and-wardrobe.md is new this cycle — covers the
  character collection and wardrobe systems in full, including what's
  explicitly planned but not built.
- **PLAN.md** → the original M1-M4 launch roadmap. M1/M2 done, M3's
  wedge test informally passed by sustained real usage. Superseded in
  practice by docs/10-build-plan.md for anything built since.

## Current state (the whole picture, not just this session)

**Core loop:** 8-question sessions generated one question at a time,
server-side, adaptive per-skill tier (1-5), spaced review, 2-round math
/ 1-round English diagnostic placement. Forward-only progress, wrong
answers get an explanation and defer to an end-of-session review round
— never an immediate retry, never a score drop.

**Content:** 13 math skills + word problems, 8 English skills including
Gemini-generated reading comprehension through a full human review
pipeline (docs/05). Tamil (Phase 3) remains explicitly on hold.

**Progression & competition:** XP (+50/session, +5/first-attempt
correct), daily streak with 2 freeze credits, weekly leaderboard with
deterministic seeded bots and promotion-only leagues (Bronze→Diamond).

**UI:** full Duolingo-style redesign — light/dark/system theme, bold
flat colors with chunky 3D pressed buttons, a winding skill-path
dashboard, small celebration moments (confetti, level-up toast, sad
mascot mood on a miss).

**Character Collection** (`/collection`, "Characters" tab) — whole-
character unlocks across switchable "seasons." Ninja Squad ships fully
seeded (8 original characters, no licensed IP by design — see AGENTS.md
"Never build these"); Hero Roster and Vehicle Garage exist as empty
seasons showing "coming soon." Chests earn from cumulative learning
time (1 per 20 min total, no daily reset). Students can also build
their own character (color/pose picker, not freeform drawing) via the
customizer — personal, never chest-gated.

**Wardrobe** (`/collection`, "Avatar" tab) — a deliberately separate,
Roblox-style system: one blocky layered avatar dressed in owned shirts/
pants/accessories, an 11-item starter catalog with rarity tiers, a coin
currency (earned per practice session by accuracy+speed, and from
chests), a coin shop, and a **daily** chest gated on 30 minutes of
practice that calendar day — a different gate than the character
system's cumulative chest, on purpose (see docs/12 for the "why two
systems" reasoning). Full detail, including exact seeded items/prices
and the coin formula, is in docs/12-collection-and-wardrobe.md.

**Admin:** /admin (usage stats), /admin/review (content review queue).

**Data model:** 22 numbered migrations on top of 001_initial.sql.
Character collection (017-019) and wardrobe (020-022) are the newest.
Run `list_migrations` against Supabase project `csmvrwqtlxolwnjocfdy`
to confirm what's actually applied — don't trust any doc's migration
count to stay current for long.

## This session (since the last handoff sync)

Live feedback session with the actual end user (my brother) drove three
back-to-back builds:

1. **Character Collection MVP** (commit `b8d8fa2`) — the whole
   seasons/chests/characters system described above, Ninja Squad as the
   seeded MVP season.
2. **Ninja rework + customizer** (commit `51fc0cf`) — first live
   feedback round: ninja characters got real bodies/poses (they'd
   originally shipped as floating head-blobs) restrained to a
   blue/red/black palette, plus the character customizer, plus a
   background/contrast fix ("too much white space").
3. **Roblox-style wardrobe pivot** (commit `93ac68f`) — second live
   feedback round, mid-conversation: after seeing the ninja rework, the
   actual request changed to "make it like Roblox" — shirts/pants/
   accessories with rarity, coins, a daily practice-gated chest. Built
   as a genuinely separate system rather than replacing the just-built
   character collection (explicit choice, confirmed via clarifying
   questions before building). Verified live end-to-end on a throwaway
   anonymous test account (buy → equip → avatar updates → daily chest
   opens and re-locks); all test mutations reverted afterward.

Also: a 4th, larger ask from the same feedback session — a 50-question
diagnostic driving a tier-synchronized 3-skill rotation with a skip-
ahead mechanic — was deliberately **not** built. It's flagged below
under "Next up" for its own dedicated planning pass, per the pattern
this project already uses for big asks (don't cram a new curriculum
subsystem in alongside three other changes).

Build, lint, and the full test suite (243 tests) were all verified
clean right after the wardrobe commit landed. Nothing in source has
changed since — only this doc sync.

## Incident history

**2026-08-09 — two production outages found and fixed in the same
session** (context for why some of the rough edges below exist):

1. Vercel had never auto-deployed from `git push` — no GitHub webhook
   was configured. Fixed via `vercel git connect`; **now confirmed
   working** (this session's 3 commits each triggered a real auto-
   deploy, verified via `list_deployments`/`get_deployment`).
2. Production's Supabase env vars were blank (`NEXT_PUBLIC_SUPABASE_URL`
   etc. existed as names but held empty strings), silently breaking
   anonymous sign-in for any visitor without an existing cookie. Re-set
   from `.env.local`, verified live. Note: `vercel env pull` always
   shows `NEXT_PUBLIC_*` vars as blank regardless of real state (Vercel
   marks them "Sensitive"/write-only) — that alone is not evidence of
   an outage; trust live behavior instead.
3. A duplicate early "Rex" test account from 2026-07-15 was found
   sitting alongside the real in-use account — confirmed as early
   testing, left alone, not lost progress.

**Lesson still standing:** Supabase free tier auto-pauses the DB after
inactivity (`get_project` shows `status: INACTIVE`; `restore_project`
fixes it, ~30-60s). Check project/deployment/env-var state directly
before assuming a reported bug is a code issue.

## Rough edges / worth knowing

- next.config.ts sets `turbopack.root` — deliberate, keep it.
- Anonymous-auth-only (no login page) means a cleared cookie is a
  silent, unrecoverable new account. No account-linking/recovery flow
  exists.
- **Dev-server session churn**: during this session's live browser
  testing, the local dev server (`npm run dev`) appeared to mint a
  fresh anonymous account on effectively every full page navigation —
  ~19 throwaway accounts (generic names like Wren/Finn/Sunny, all
  0 XP) created within one browser automation session. Production
  cookie persistence was not affected. If a live dev-mode check ever
  shows unexpectedly zeroed-out state, check `public.users` grouped by
  `created_at` before assuming a data bug — it may just be a different
  anon account than the one you think is active.
- Wardrobe shop has no "preview item on avatar before buying" and no
  duplicate/re-roll protection beyond plain ownership dedup — both
  flagged as possible follow-ups, not requested yet.
- SETUP.md is the original pre-deploy runbook — likely stale now that
  deployment is real; treat as historical, not authoritative.

## Next up

The one deferred, sizeable item from this session's feedback, waiting
on its own dedicated planning pass (do not start without re-confirming
scope first):

**Diagnostic → adaptive workout plan.** A 50-question diagnostic per
subject (math and English independently) that seeds a workout plan of
3 skills the student rotates through, all three advancing tier-by-tier
in lockstep (every skill clears level 1 before any moves to level 2,
and so on). Acing every question in a level — including its hard
checkpoint — skips the whole rotation ahead a level. A second
diagnostic after the plan completes measures improvement. This needs a
new plan-state schema and tier progression synchronized across 3
skills instead of independent per skill (today's model) — genuinely new
curriculum-state territory, not a small addition.

Smaller, lower-priority items also worth knowing about (not blocking,
not requested yet): Hero Roster and Vehicle Garage still need their own
original-IP character rosters; wardrobe catalog is a deliberately small
11-item MVP seed, not a target size.

Otherwise this project is in steady-state feature/polish work driven by
direct feedback, not a fixed roadmap — check with Ashwin for what's
next rather than assuming any older doc's sequence still applies.
