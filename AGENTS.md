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
- **No leaderboard or new subject until its phase.** These each have a
  doc (06, 03/04) — read the phase gate before touching them.
- **Do not extend the adaptive engine past its shipped first slice**
  (grade-seeded starting tier, +-1 stepping per primary-pass question)
  without re-reading doc 08 — no spaced-repetition scheduling, no
  interleaving, no finer-grained difficulty yet.

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

Build-plan discipline: Phase 1 (the math loop) must actually hook him
before Phase 2 (review pipeline + English) starts. Do not build ahead
of the current phase without being asked.

## Stack

- Next.js 16 App Router (no src/ dir), React 19, TypeScript strict
- Tailwind CSS v4 (PostCSS plugin, no tailwind.config file)
- Supabase: Postgres + Auth (email/password) via @supabase/ssr
  (lib/supabase/client.ts, server.ts, middleware.ts)
- Server Actions for session logic (app/actions/session.ts) — not API
  routes
- canvas-confetti for the completion screen
- Deploy: Vercel

## Current state (Phase 0 + Phase 1 built)

- Auth: signup/login; new users default to role `student`, admin role
  set manually in the Supabase table editor
- Route groups: app/(auth)/login, app/(student)/dashboard|session
  (no /skills page exists — skills render on the dashboard)
- 8-question sessions, generated one question at a time server-side as
  the student progresses; grading in app/actions/session.ts
  (startSession, getSessionForRunner, getNextQuestion, gradeAnswer,
  completeSession, getSessionProgress)
- Engagement loop: forward-only progress, wrong → explanation, no
  immediate retry — a missed question is deferred to a "missed
  questions" review round at the end of the session and must be
  answered correctly there to finish
- Adaptive difficulty (first slice, see 08): each skill has a
  per-student tier (1-3) in user_skill_progress, seeded from grade
  (lib/mastery.ts) and stepped +-1 after every primary-pass question
  based on first-attempt correctness. The missed-questions review does
  not step the tier — it re-serves the same question at its original
  difficulty until answered correctly
- XP (+50 per completed session, +5 per first-attempt correct) and
  daily streak with 2 freeze credits
- Math skills (12): multiplication, division, fractions, decimals,
  place value, rounding, addition, subtraction, factors & multiples,
  prime & composite, fraction multiplication, elapsed time — three
  tiers each; distractors modeled on real error patterns (off-by-one,
  wrong operation, place-value slips). Multi-step word problems and
  anything needing a diagram (geometry, line plots) are explicitly
  out of scope — see docs/02-content-math.md "Not in v1"
- Schema + RLS + skill seed in supabase/migrations/001_initial.sql
  (+ 005_more_math_skills.sql for the later 8);
  adaptive engine schema in 004_user_skill_progress.sql

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
