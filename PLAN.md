# LEARNLOOP — PRD & Roadmap (standing plan)

**Status as of 2026-08-09: M1 and M2 are done. M3's wedge test has no
formal written verdict, but 17+ real sessions of sustained use since
2026-07-20 is a strong informal "hooked" signal.** Phases well beyond
what this file's M4 gate anticipated have since shipped (English,
leaderboard leagues, spaced review, a full UI redesign) — see
docs/10-build-plan.md for what's actually built, and AGENTS.md's
"Current state" for the full current feature list. This file is kept
as the original launch narrative/rationale, not a live task list —
don't treat its M4 gate as still blocking new work.

Execute task by task, in order. Read AGENTS.md first (hard rules), and
docs/10-build-plan.md (the phase logic). This plan operationalizes the
next phases — it does not replace the docs/ spec.

## 1. Objective

Get Phase 1 (the math engagement loop) **into Ashwin's brother's hands
and find out if he comes back on his own**. He is a 4th grader with
ADHD; the product bet is that a forgiving, fixed-length, game-shaped
loop beats IXL's punishing one. Everything else — English, Tamil,
leaderboards — is gated on this wedge test passing. The outcome we
want: evidence (not vibes) that he opens it voluntarily and finishes
sessions.

## 2. Context

- Phase 0 + 1 are BUILT but **never shipped to the real user**: auth,
  dashboard, 8-question server-graded sessions, forward-only progress,
  XP/streaks, four math skills with three tiers each. One commit,
  local-only, no deployment.
- Spec lives in docs/ (one doc per feature). Schema + RLS in
  supabase/migrations/001_initial.sql. Setup steps in SETUP.md.
- Must not break: the five non-negotiables in AGENTS.md (no punished
  wrong answers, fixed session length, code-computed math, human
  review for factual content, answers never reach the client).

## 3. Success criteria

- [ ] App is deployed on Vercel with a production Supabase project and
      his brother has a working student account
- [ ] His brother completes a full session on his own device without
      help
- [ ] Ashwin can see, without asking him: sessions started/completed
      per day, streak status, first-attempt accuracy per skill
- [ ] Two weeks of real usage data exist and the wedge question ("does
      he come back unprompted?") has an answer written down
- [ ] Phase 2 work has NOT started unless the answer was yes

## 4. Constraints

- The five AGENTS.md non-negotiables, always.
- Do not build Phase 2 (review pipeline, English) or leaderboards
  until the wedge gate passes — this is the whole point of the build
  plan.
- Keep it free tier: Supabase free project, Vercel hobby.
- The student experience only changes if a fix makes the loop more
  playable — no new mechanics during the test window (clean
  experiment).

## 5. Milestones

- **M1 — Ship it.** Deployed, accounts created, works on his device.
- **M2 — Instrument it.** Ashwin can observe usage without asking.
- **M3 — The wedge test.** Two weeks of real use, verdict written.
- **M4 (gated) — Act on the verdict.** Fix the loop, or start Phase 2
  per docs/05 + docs/03.

## 6. Task breakdown

### M1 — Ship it

1. **Production Supabase.** Create the project, run
   supabase/migrations/001_initial.sql via SQL Editor, verify tables +
   RLS + skill seeds per SETUP.md. Files: none (external) — record the
   project ref in SETUP.md. Done when: tables visible, RLS enabled,
   skills seeded.
2. **Deploy to Vercel.** Link repo (push to GitHub first if not
   already remote), set the three env vars, update
   NEXT_PUBLIC_SITE_URL. Files: none. Done when: production URL loads
   /login and a full session completes in production.
3. **Create the real accounts.** Brother = student, Ashwin = student
   then flip role to admin in the users table. Done when: both log in
   on the production URL.
4. **Device pass.** Run a full session on the actual device he'll use
   (likely tablet/phone — verify with Ashwin). Fix tap targets, font
   sizes, viewport issues found. Files: app/(student)/session/*,
   globals.css as needed. Done when: a session is comfortably
   playable on his device.
5. **Commit + handoff.** The repo currently has uncommitted changes
   and one commit total. Commit, push, update AGENTS.md/SETUP.md with
   deployment reality. Done when: clean tree, docs current.

### M2 — Instrument it

1. **Usage queries.** The schema already records sessions/answers.
   Write and save 4 SQL queries (sessions per day, completion rate,
   first-attempt accuracy by skill, streak history) in a new
   docs/11-usage-queries.md. Done when: each query runs in Supabase
   SQL editor against real data.
2. **Admin usage page.** Minimal /admin route (role-gated) rendering
   those four numbers. No charts needed — numbers and a table. Files:
   app/(admin)/admin/page.tsx, a server action or query helper. Done
   when: Ashwin sees real usage without opening Supabase.
3. **Session-event sanity check.** Verify XP, streak, and re-queue
   behavior write correct rows during a real session (play one and
   inspect). Done when: data matches what happened.

### M3 — The wedge test

1. **Run the test.** Two weeks, no prompting after day 1. Ashwin
   checks the admin page; Claude's job is only to fix anything broken
   within 24h (bugs jump the queue during the window). Done when: 14
   days elapsed.
2. **Write the verdict.** Add a dated section to docs/10-build-plan.md:
   the numbers, what he said, and the call — hooked / promising-but-fix
   / not landing. Done when: the verdict paragraph exists.

### M4 — Act on the verdict (GATED — do not start early)

- **If "fix the loop":** diagnose against docs/01 (pacing, feedback,
  reward timing), one change at a time, re-test. Tasks defined then.
- **If "hooked":** begin Phase 2 per docs/10 — content lifecycle +
  admin review view (docs/05), then English grammar + reading
  (docs/03). Break into tasks at that point, in this file.
- **If "not landing":** stop building. Talk to Ashwin.

## 7. Handoff notes

- The non-negotiables in AGENTS.md are product identity, not style
  preferences. When in doubt, re-read docs/01.
- Server Actions own all session logic; nothing about answers or
  grading may move client-side for convenience.
- The build plan's discipline is the plan: proving the loop beats
  adding features. Resist the urge to build Phase 2 early — that urge
  is the failure mode.
- SETUP.md is the deployment runbook; keep it exact as you deploy
  (M1 will surface drift — fix the doc as you go).
