# 10. Build Plan

Phased so each step proves something before the next. The order is chosen so the riskiest assumption gets tested first with the least work.

## The one assumption that matters

Does he actually open it and enjoy it. Everything else is downstream of that. So the first build is the smallest thing that can answer it, and math is that thing because it needs no LLM at serve time and is fully verifiable. If a clean, forgiving, well-paced math loop does not hook him, adding English, Tamil, and leaderboards will not save it. Test the loop before building the rest.

## Phase 0. Foundation

- Next.js plus Supabase project, auth, the core schema from 07
- A single student account (him) and an admin account (me)
- No content yet, just the skeleton

## Phase 1. The loop on math

- Parametric math generation for the core four operations (02), code-verified
- The full engagement loop (01). Fixed-length sessions, no punishment, re-queue wrong answers, instant feedback, completion screen, XP, daily streak
- Enough published math to run real sessions
- Ship this to him and watch. This is the wedge test. Does he come back without being told

**Status: done, wedge test informally passed.** Deployed since 2026-07-20 with 17+ real sessions of sustained use on the account in active use — no separate written verdict was ever recorded, but the usage data itself is the answer. Do not proceed to Phase 2 until Phase 1 actually hooks him. If it does not, fix the loop, not the subject list.

## Phase 2. Review pipeline plus English

**Status: done.** All three English content pillars from 03 are live: grammar (rule-based, no review needed), vocabulary (also rule-based, hand-authored word bank), and reading comprehension (Gemini-generated passages + questions through the full draft/pending/published/rejected pipeline from 05, admin review UI at /admin/review).

- ~~Add grammar (rule-based, light review) from 03~~ — done
- ~~Build the content lifecycle and the admin review view (05)~~ — done
- ~~Add reading comprehension (original passages, full review) from 03~~ — done
- ~~Add vocabulary (rule-based, no review) from 03~~ — done

## Phase 3. Tamil

**Status: explicitly on hold — do not start without being asked**,
even though every other phase has since shipped. This is the one
phase that hasn't followed the "each phase unblocks the next" order
below; it's parked by request, not by an unmet gate.

- Hand-seed the core script and vocabulary (04)
- AI-assisted exercise variation over the verified set, everything reviewed
- Add audio for the core set, self-recorded if that is the reliable route
- Confirm Tamil renders correctly on his device before loading content

## Phase 4. Leaderboard

**Status: done, including leagues.** Weekly board, cohort by grade, bots use a deterministic seeded function computed live at read time instead of a scheduled job — same effect (a believable weekly earning timeline per bot) without needing a cron job. Leagues (Bronze through Diamond, promotion-only) shipped later (supabase/migrations/015_leaderboard_leagues.sql) — the "deferred" note that used to be here is stale, tournaments are the only piece still not built.

- ~~Weekly board, cohort by grade (06)~~ — done
- ~~Bots as pre-generated weekly earning timelines~~ — done, computed live instead of scheduled
- ~~Leagues, promotion ladder (Bronze-Diamond)~~ — done, promotion-only (no relegation)
- Tournaments — still not built
- Tune the distribution so his normal effort is mid-pack and a strong week tops it — not yet formally validated against real usage, but real usage exists now to validate against

## Phase 5. Adaptive engine

**Status: both signals from 08's "simple first version" are done.**

- ~~Per-skill mastery, tier stepping ±1 per question~~ — done, tier
  scale later widened from 1-3 to 1-5 (supabase/migrations/016_widen_tiers.sql)
  so it keeps differentiating difficulty past grade 5
- ~~Spaced review — missed items re-queued sooner, aced items pushed
  out further~~ — done (`due_for_review_at` on user_skill_progress,
  supabase/migrations/014_spaced_review.sql)
- Interleaving, finer-grained difficulty control beyond the 5-tier
  scale — not built, per 08's own "add only if the simple version
  clearly helps" guidance

## How to know each phase worked

- Phase 1, he opens it unprompted and finishes sessions
- Phase 2, generated English passes your review without heavy editing and reads at grade level
- Phase 3, Tamil renders and reads correctly and he can use the script exercises
- Phase 4, the leaderboard feels alive and he chases rank
- Phase 5, accuracy on weak skills climbs over time

## Handoff to Claude Code

Phases 0, 1, 2, 4, and 5's first slice are built and live (see status
notes above and AGENTS.md's "Current state" for the full current
feature list) — this section's original "start with Phase 0/1 only"
instruction is historical, not current guidance. Phase 3 (Tamil)
remains the one phase still gated, on hold by explicit request rather
than an unmet build-order dependency.
