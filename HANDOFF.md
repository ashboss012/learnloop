# LearnLoop — Handoff

**As of:** 2026-07-08. First real commit of the full app landed today
(the previous sole commit was the create-next-app scaffold; everything
— app/, components/, lib/, the migration, SETUP.md — had been sitting
untracked). Private GitHub remote created and pushed.

## Read this first

AGENTS.md → hard rules (the five non-negotiables) and conventions.
docs/ → the full product spec, one doc per feature.
PLAN.md → the standing roadmap. The entire plan is gated on the wedge
test: ship Phase 1 to Ashwin's brother and find out if he comes back
unprompted. Do not build Phase 2 before that answers.

## Current state

- Phase 0 + 1 built and building clean (`npm run build` exit 0):
  auth, dashboard, 8-question server-graded sessions, forward-only
  progress, XP/streaks, four math skills × three tiers.
- **Never deployed. Never used by the real user.** No production
  Supabase project, no Vercel deployment. That is PLAN M1.
- Routes that exist: /login, /dashboard, /session/[sessionId] (plus
  /api/auth/signout). There is NO /skills page — an empty directory
  that suggested one was removed 2026-07-08; skills render on the
  dashboard.

## Rough edges / worth knowing

- next.config.ts sets `turbopack.root` — deliberate, keep it.
- SETUP.md is the deployment runbook; it was written before any real
  deploy, so expect drift and fix the doc as you execute PLAN M1.
- supabase/migrations/001_initial.sql is the single migration —
  schema changes get NEW numbered files (see AGENTS.md conventions).

## Next up

PLAN.md → M1 task 1: create the production Supabase project and run
the migration. Then M1 in order (deploy, accounts, device pass).
