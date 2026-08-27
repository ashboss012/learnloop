<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# LEARNLOOP — Project Context

Read this before writing any code. The full product spec lives in
`docs/` — this file orients you, states the hard rules, and tells you
which doc to open. Fix one feature by reading one doc, not by guessing.
The standing implementation plan (what to do next, task by task) is
PLAN.md — work it in order.

## What this is

A "Duolingo for school subjects" practice app for younger kids broadly,
ADHD-friendly by design rather than ADHD-only. First user is my brother
(4th grade). He doesn't have a content problem, he has a delivery
problem: IXL's reward structure punishes wrong answers and has no
visible finish line; Duolingo's shape works.

The emerging go-to-market is independent tutors and small learning
centers — validated with real tutors and parents — who need to assign
practice to students who just need reps, not instruction. This app is
a rep machine, not a tutoring replacement. A tutor dashboard is a
FUTURE phase; do not build it now.

## The non-negotiables (hard rules — never violate)

1. **No session ever punishes a wrong answer.** Wrong means re-do plus
   explanation, never a score drop. The progress bar only moves
   forward.
2. **Every session has a fixed, small, visible length** with a clear
   end. No unbounded or regressing score targets, ever.
3. **Math answers are computed in code, never trusted from an LLM.**
   Serve-time math has no LLM in the loop at all (lib/math/generator.ts
   is parametric).
4. **Fact-heavy content is grounded in a source and reviewed by a human
   before it reaches him.** English/Tamil content goes through the
   review pipeline (docs/05); nothing AI-generated ships unreviewed.
5. **The correct answer is never sent to the client.** Sessions are
   generated and graded server-side (app/actions/session.ts).

## Never build these

Features that sound helpful but break the core promise. Any agent
working on this project must refuse to add them unprompted:

- **No timers or countdowns anywhere.** Time pressure is the opposite
  of the goal.
- **No hearts, lives, or any mechanic that can lock the user out.**
- **No score, streak, or XP that can decrease. Ever.**
- **Tamil (Phase 3, doc 04) is explicitly on hold** — do not start or
  touch it until the user says so, even though every other phase has
  shipped.
- **Do not add interleaving or a rolling accuracy window** to the
  adaptive engine without re-reading doc 08 first — per-skill tiering
  and spaced review (both shipped, see below) are as far as it goes
  for now.

## Where the spec lives (docs/)

| Doc | Covers |
|---|---|
| docs/README.md | Product overview + non-negotiables |
| 01-engagement-loop.md | Session mechanics — the heart of the app |
| 02-content-math.md | Parametric generation, code-verified answers |
| 03-content-english.md | Grammar rules + original reading passages |
| 04-content-tamil.md | Heritage-language content, hand-seeded core |
| 05-content-review-pipeline.md | Human review lifecycle |
| 06-leaderboard.md | Competitive pull (later phase) |
| 07-data-model.md | Schema — matches supabase/migrations/001_initial.sql |
| 08-adaptive-engine.md | Adaptive engine (LATER) — built on real learning science (spaced repetition, retrieval practice, mastery progression), NOT learning styles, which are debunked. |
| 09-tech-stack-architecture.md | Stack decisions |
| 10-build-plan.md | Phase order + why — READ BEFORE ADDING FEATURES |
| 12-collection-and-wardrobe.md | Character collection + avatar wardrobe — current state, what's planned |

Build-plan discipline: Phases 0-2, 4, and a first slice of 5 have
shipped and are live with real usage (see "Current state" below).
Phase 3 (Tamil) is the one phase still explicitly on hold — do not
start it without being asked. Otherwise, don't build ahead of what's
been asked for in a given session.

## Stack

- Next.js 16 App Router (no src/ dir), React 19, TypeScript strict
- Tailwind CSS v4 (PostCSS plugin, no tailwind.config file)
- Supabase: Postgres + Auth via @supabase/ssr (lib/supabase/client.ts,
  server.ts, middleware.ts). **Anonymous auth, not email/password** —
  there is no login page; lib/supabase/middleware.ts calls
  `signInAnonymously()` for any visitor with no session. This means
  there is no account-recovery path if a device's cookie is ever
  cleared — worth knowing before assuming email/password flows exist.
- next-themes for light/dark/system theming (class-based, see
  app/globals.css's `.dark` overrides and `@custom-variant dark`)
- Server Actions for session logic (app/actions/session.ts) — not API
  routes
- canvas-confetti for the completion screen
- Deploy: Vercel (learnloop-sooty.vercel.app), linked to this GitHub
  repo for auto-deploy on push to master

## Current state (as of 2026-08-20 — deployed, real usage, well past Phase 1)

- **Live in production**, real usage since 2026-07-20 (17+ real sessions
  on the account in active use). The M1-M3 wedge test from PLAN.md has
  been informally passed by sustained real usage — no separate written
  verdict doc exists, but the data speaks for itself.
- Auth: anonymous only, no login page (see Stack above). New anon
  visitors get a `users` row via a `handle_new_user` trigger, default
  role `student`; admin role set manually in the Supabase table editor.
- Route groups: app/(student)/(tabs)/dashboard|session|stats|leaderboard
  |profile, app/(admin)/admin(/review). No /skills page — skills render
  on the dashboard as a winding "skill path" (components/SkillPath.tsx).
- 8-question sessions, generated one question at a time server-side as
  the student progresses; grading in app/actions/session.ts
  (startSession, getSessionForRunner, getNextQuestion, gradeAnswer,
  completeSession, getSessionProgress, plus getSkipCheckpoint/
  resolveSkipCheckpoint for the perfect-run skip-ahead reward)
- Engagement loop: forward-only progress, wrong → explanation, no
  immediate retry — a missed question is deferred to a "missed
  questions" review round at the end of the session and must be
  answered correctly there to finish
- Adaptive engine (see 08, both signals shipped):
  - Per-skill tier, **1-5** (widened from an original 1-3 scale —
    supabase/migrations/016_widen_tiers.sql), seeded from grade
    (lib/mastery.ts, `MAX_TIER` constant) and stepped +-1 after every
    primary-pass question based on first-attempt correctness. The
    missed-questions review does not step the tier.
  - Spaced review: `due_for_review_at` on user_skill_progress, set
    sooner after a miss and further out after a perfect run
    (completeSession in app/actions/session.ts); surfaced on the
    dashboard as a sort-to-front + "🔁 Review" badge.
  - 2-round math / 1-round English diagnostic placement
    (app/actions/diagnostic.ts) places a never-practiced skill onto
    {1, 3, 5} before the student's first real session on it.
- XP (+50 per completed session, +5 per first-attempt correct) and
  daily streak with 2 freeze credits
- Math skills (13): multiplication, division, fractions, decimals,
  place value, rounding, addition, subtraction, factors & multiples,
  prime & composite, fraction multiplication, elapsed time, **word
  problems** (single-step at tiers 1-3, two-step chained at 4-5,
  lib/math/wordProblems.ts) — 5 tiers each; distractors modeled on real
  error patterns (off-by-one, wrong operation, place-value slips,
  skipped-a-step). Geometry/measurement/line plots (need a rendered
  diagram) are still out of scope — see docs/02-content-math.md
  "Not in v1", now the only item left there.
- English skills (8): parts of speech, subject-verb agreement, tenses,
  punctuation, capitalization, plurals, vocabulary — same generator
  architecture as math (on-demand, no LLM), content from hand-authored
  word/sentence banks in lib/english/generator.ts, 5 tiers each. Plus
  **reading comprehension** (lib/readability.ts + Gemini-generated
  passages/questions through the full draft/pending/published/rejected
  review pipeline from doc 05, admin review UI at /admin/review) — the
  one English skill with no adaptive tier, since it serves from a
  reviewed content pool instead of the parametric generator.
- Leaderboard (doc 06): weekly XP board with deterministic seeded bots
  (computed live at read time, no cron job), **plus leagues** (Bronze
  through Diamond, promotion-only, supabase/migrations/
  015_leaderboard_leagues.sql) — the "leagues deferred" note in older
  docs is stale.
- Admin: /admin (usage stats: sessions/day, accuracy by skill), plus
  /admin/review (content review queue for reading comprehension).
- UI: full Duolingo-style redesign — light/dark/system theme
  (next-themes, app/globals.css `.dark` overrides), bold flat colors
  with `color-mix()`-derived chunky 3D pressed buttons (`.btn-3d`),
  the winding skill-path dashboard layout, and small celebration
  moments (sad mascot mood, level-up toast, streak-milestone banner)
  layered on the pre-existing confetti/completion screens.
- lib/questionGenerator.ts routes generateQuestion() by slug prefix
  (math-*/english-*) to the right subject's generator module
- **Character Collection** (docs/12, `/collection` "Characters" tab):
  whole-character unlocks organized into switchable "seasons"
  (character_seasons/characters/user_characters, migration 017).
  Ninja Squad ships fully seeded (8 original characters — no licensed
  IP, see "Never build these"); Hero Roster and Vehicle Garage exist
  as seasons with zero characters yet. Chests earn from **cumulative**
  learning time (1 per 20 min total, `total_learning_seconds()` RPC,
  each session capped at 20 min). Bodies are a parametric SVG
  (components/CharacterAvatar.tsx, 4 reusable pose templates, palette
  restrained to blue/red/black). Students can also build their own
  character (color/pose/name picker, not freeform drawing) via
  components/CharacterCustomizer.tsx — stored in custom_characters,
  personal per-student, never chest-gated.
- **Wardrobe** (docs/12, `/collection` "Avatar" tab): a separate,
  Roblox-style system — one blocky layered avatar
  (components/AvatarView.tsx) dressed in owned shirts/pants/
  accessories (wardrobe_items/user_wardrobe_items, migrations 020-022).
  11-item starter catalog across common/rare/epic/legendary. **Coins**
  are a currency separate from XP: earned per completed practice
  session scaled by accuracy + speed (lib/coins.ts, wired into
  completeSession/resolveSkipCheckpoint), and from a **daily** chest
  gated on 30 min of practice *that calendar day*
  (`today_practice_seconds`/`wardrobe_chest_available` RPCs — a
  different gate than the character system's cumulative chest, by
  deliberate choice; the two systems don't share a pool). Items can
  also be bought directly with coins in-app (no chest needed).
  Deliberately kept separate from Character Collection rather than
  merged — see docs/12 for why.
- Schema + RLS + skill seed in supabase/migrations/001_initial.sql,
  extended by 21 further numbered migrations since (002 through 022 —
  see supabase/migrations/ for the full list). Diagnostic, leaderboard
  leagues, spaced review, reading comprehension, vocabulary, tier
  widening, character collection, and the wardrobe system each landed
  as their own migration(s). Run `list_migrations` against the
  Supabase project (id csmvrwqtlxolwnjocfdy) to confirm what's
  actually applied rather than trusting this list to stay current.
- **Known rough edges, not yet fixed:**
  - GitHub auto-deploy is now wired up (fixed 2026-08-09) — `git push`
    to master triggers a Vercel production deploy. Still worth
    confirming via `vercel ls` after a push if a deploy seems to not
    have landed, rather than assuming it silently works forever.
  - Supabase free tier auto-pauses the DB after a stretch of
    inactivity — if a live check shows empty data / timeouts, check
    project status first (`get_project`) before assuming a code bug.
  - Anonymous-auth-only means a cleared cookie = a silent brand-new
    blank account, no recovery path. A duplicate early account exists
    from 2026-07-15 (abandoned 07-18) — confirmed as early testing,
    left in place, not the real user's lost progress.
  - The Next.js dev server (`npm run dev`) mints a fresh anonymous
    account on effectively every full page navigation in some
    environments (observed during 2026-08-19 browser-based testing —
    ~19 throwaway accounts created in one session). Cookie persistence
    works fine in the deployed production environment; this appears
    dev-server/tooling-specific. If a live dev-mode check shows
    unexpected zeroed-out state, suspect a fresh anon account before
    assuming a data bug — check `public.users` by `created_at` cluster.
  - Wardrobe shop has no "preview on avatar before buying" and no
    duplicate/re-roll protection beyond plain ownership dedup — both
    flagged as possible follow-ups, not yet requested.

## Environment

NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
NEXT_PUBLIC_SITE_URL — see SETUP.md for the full setup walkthrough.

## Conventions

- Session/game logic goes in Server Actions; answers and grading never
  leave the server.
- New math skills extend lib/math/generator.ts with computed answers
  and error-pattern distractors — follow the existing
  GeneratedQuestion/buildChoices shape.
- Schema changes: add a new numbered file under supabase/migrations/
  and update docs/07-data-model.md to match.
- The user is a 4th grader with ADHD: copy short, feedback instant,
  UI shaped like a game, never like a worksheet.

## Definition of done

- [ ] `npm run build` and `npm run lint` pass clean
- [ ] `npm test` passes clean
- [ ] The five non-negotiables above still hold (walk through each one
      against your change)
- [ ] A wrong answer in your feature path shows an explanation, defers
      to the missed-questions review round, and never moves progress
      backward
- [ ] No correct answer or grading logic reaches the client bundle
- [ ] The matching doc in docs/ is updated if behavior changed, and
      SETUP.md is updated if setup steps changed
- [ ] New math skills ship with generator tests proving the computed
      answer is correct
- [ ] New features that touch the session loop ship with tests for
      every non-negotiable they touch
