# LearnLoop — Handoff

**As of:** 2026-08-09. Deployed and in real use since 2026-07-20.
This file was badly stale until today (still described the 07-08
pre-deployment snapshot) — a comprehensive audit found and fixed two
live production outages in the process of updating it. See "Incident
history" below.

## Read this first

AGENTS.md → hard rules (the five non-negotiables), current shipped
state, and conventions. Read its "Current state" section before
assuming anything about what exists.
docs/ → the full product spec, one doc per feature. docs/10-build-plan.md
tracks phase status.
PLAN.md → the original M1-M4 launch roadmap. M1 (ship it) and M2
(instrument it) are done; M3's wedge test was never given a formal
written verdict but is informally passed by 17+ real sessions of
sustained use since 07-20. Superseded in practice by docs/10-build-plan.md
for what's actually been built since.

## Current state

Live at https://learnloop-sooty.vercel.app. Full feature set (math +
English with 5-tier adaptive difficulty, diagnostics, spaced review,
leaderboard leagues, admin review pipeline, full Duolingo-style UI
redesign) — see AGENTS.md's "Current state" section for the complete,
current list rather than duplicating it here.

Tamil (Phase 3) is the one phase still explicitly on hold — do not
start it without being asked.

## Incident history

**2026-08-09 — two production outages found and fixed in the same
session:**

1. **Vercel had not auto-deployed from `git push` in 14+ days** — no
   GitHub webhook was ever configured, every prior deploy was a manual
   `vercel --prod`. `vercel git connect` reported the repo as "already
   connected," but that alone doesn't guarantee auto-deploy triggers —
   **verify this by checking whether a push actually triggers a new
   deployment (`vercel ls`) before trusting it's fixed.**
2. **Production's Supabase env vars were blank** (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` all empty
   strings in Vercel's Production environment, despite existing as
   variable names). This silently broke anonymous sign-in and all data
   loading for any visitor without an existing session cookie — the
   dashboard rendered with zero skills and no error. Re-set from
   `.env.local` values and redeployed; verified live with a fresh
   incognito-equivalent visit (new anon account created, skills
   loaded, diagnostic flow completed).
   - **Note:** Vercel marks `NEXT_PUBLIC_*` vars as "Sensitive" type,
     which means `vercel env pull` always returns them blank — that is
     NOT itself evidence of a real outage. Trust live behavior (does a
     fresh visit actually create a session and load skills?) over
     `vercel env pull` output.
3. Also found (not a bug, confirmed with the user): a duplicate "Rex"
   account from 2026-07-15 (5 sessions, abandoned 07-18) sitting
   alongside the real account in active use since 07-20. Confirmed as
   early testing, left alone.

**Lesson for future sessions:** a Supabase free-tier project also
auto-pauses after a stretch of inactivity (`get_project` will show
`status: INACTIVE`; `restore_project` brings it back, takes ~30-60s).
Check project + deployment + env-var state directly before assuming a
reported bug is a code issue — this session's actual code was fine;
the infrastructure around it had silently drifted.

## Rough edges / worth knowing

- next.config.ts sets `turbopack.root` — deliberate, keep it.
- Anonymous-auth-only (see AGENTS.md Stack section) means a cleared
  cookie is a silent, unrecoverable new account. No account-linking or
  recovery flow exists.
- SETUP.md is the original pre-deploy runbook — likely stale now that
  deployment is real; treat it as historical, not authoritative.

## Next up

Nothing blocking. Tamil (Phase 3, docs/04) remains on hold until
explicitly requested. Otherwise this project is in steady-state
feature/polish work, not a fixed roadmap — check with the user for
what's next rather than assuming PLAN.md's original M-numbered
sequence still applies.
