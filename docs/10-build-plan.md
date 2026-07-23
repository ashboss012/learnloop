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

Do not proceed to Phase 2 until Phase 1 actually hooks him. If it does not, fix the loop, not the subject list.

## Phase 2. Review pipeline plus English

**Status: done.** All three English content pillars from 03 are live: grammar (rule-based, no review needed), vocabulary (also rule-based, hand-authored word bank), and reading comprehension (Gemini-generated passages + questions through the full draft/pending/published/rejected pipeline from 05, admin review UI at /admin/review).

- ~~Add grammar (rule-based, light review) from 03~~ — done
- ~~Build the content lifecycle and the admin review view (05)~~ — done
- ~~Add reading comprehension (original passages, full review) from 03~~ — done
- ~~Add vocabulary (rule-based, no review) from 03~~ — done

## Phase 3. Tamil

- Hand-seed the core script and vocabulary (04)
- AI-assisted exercise variation over the verified set, everything reviewed
- Add audio for the core set, self-recorded if that is the reliable route
- Confirm Tamil renders correctly on his device before loading content

## Phase 4. Leaderboard

**Status: shipped in reduced scope, deliberately.** Single weekly board (not full multi-league promotion), cohort by grade. Bots use a deterministic seeded function computed live at read time instead of a scheduled job — same effect (a believable weekly earning timeline per bot) without needing a cron job. Leagues/promotion ladder and tournaments were explicitly deferred, not forgotten - revisit if the single board stops feeling like enough.

- ~~Weekly board, cohort by grade (06)~~ — done, single board
- ~~Bots as pre-generated weekly earning timelines~~ — done, computed live instead of scheduled
- Tune the distribution so his normal effort is mid-pack and a strong week tops it — not yet validated against real usage
- Leagues, promotion/relegation, tournaments — deferred

## Phase 5. Adaptive engine, later

- Only after the above is stable and he is using it
- Start with the simple version in 08. Per-skill mastery plus spaced re-queue, from data you already store
- Built on real learning science, not learning styles

## How to know each phase worked

- Phase 1, he opens it unprompted and finishes sessions
- Phase 2, generated English passes your review without heavy editing and reads at grade level
- Phase 3, Tamil renders and reads correctly and he can use the script exercises
- Phase 4, the leaderboard feels alive and he chases rank
- Phase 5, accuracy on weak skills climbs over time

## Handoff to Claude Code

Build in Claude Code from these files. Start with Phase 0 and Phase 1 only. Point Claude Code at 07 for the schema, 01 for the loop, and 02 for math generation. Leave the rest for later phases so the first build stays small and you get it in front of him fast.
