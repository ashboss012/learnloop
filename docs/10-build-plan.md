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

**Status: grammar shipped, reading comprehension + review pipeline not started.** Grammar didn't need the content lifecycle or admin review view — it's rule-based and code-verified like math (03), so it's generated on-demand with no LLM, same architecture as the math skills (lib/english/generator.ts). Reading comprehension is the part still gated: it needs an LLM API key (none configured yet) and the actual review pipeline (05) — draft/pending/published/rejected content lifecycle, admin review UI, offline batch generation. Read 05 fully before starting that half.

- ~~Add grammar (rule-based, light review) from 03~~ — done
- Build the content lifecycle and the admin review view (05)
- Add reading comprehension (original passages, full review) from 03
- Once both land, the app has a working way to add safe content beyond grammar

## Phase 3. Tamil

- Hand-seed the core script and vocabulary (04)
- AI-assisted exercise variation over the verified set, everything reviewed
- Add audio for the core set, self-recorded if that is the reliable route
- Confirm Tamil renders correctly on his device before loading content

## Phase 4. Leaderboard

- Weekly leagues, cohort by grade (06)
- Bots as pre-generated weekly earning timelines, revealed on a schedule
- Tune the distribution so his normal effort is mid-pack and a strong week tops it
- Scheduled job to advance bot XP and reset weekly

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
