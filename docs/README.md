# Project Overview

Working name TBD. An ADHD-friendly learning app built for one real user first (my brother, 4th grade) and designed to expand to a small cohort later.

## The core insight

He does not have a content problem. He has a delivery problem. IXL has fine content but the wrong reward structure for an ADHD brain. It punishes wrong answers, the SmartScore can drop so the task is unbounded and can move backward, and it looks like a worksheet. Duolingo runs the same underlying activity (repetitive drilling) in a shape that works. Fixed short sessions, forgiving failure, instant feedback, a visible finish line, and a competitive pull.

So we are not building better content. We are building an engagement loop wrapped around content that we generate and verify.

## What he actually likes about Duolingo (confirmed, not guessed)

- Game feel
- No punishment for a wrong answer. It re-shows the question and explains it
- Fixed number of questions per lesson, not a moving score target
- Leaderboards that push him to keep going

The load-bearing one is the fixed finish line. Every session is a small, visible, completable number of questions with no score that can regress. If we copy one thing, copy that.

## Subjects at launch

Math, English, Tamil. Other subjects (history, science) come later and carry higher AI-generation risk, so they wait until the review pipeline is proven.

## The non-negotiables

1. No session ever punishes a wrong answer. Wrong means re-do plus explanation, never a score drop.
2. Every session has a fixed, small, visible length with a clear end.
3. Math answers are computed in code, never trusted from an LLM.
4. Fact-heavy content is grounded in a source and reviewed by a human before it reaches him.

## Document map

Fix one feature by reading one file.

| File | What it covers |
|------|----------------|
| 01-engagement-loop.md | The session mechanics. The heart of the app |
| 02-content-math.md | Parametric generation, code-verified answers |
| 03-content-english.md | Grammar rules and original-passage reading comprehension |
| 04-content-tamil.md | Heritage-language content, script, hand-seeded core |
| 05-content-review-pipeline.md | How content is generated, queued, reviewed, published |
| 06-leaderboard.md | Real users plus believable bots, weekly leagues |
| 07-data-model.md | Supabase schema, the shared spine |
| 08-adaptive-engine.md | Later feature. Built on real learning science, not learning styles |
| 09-tech-stack-architecture.md | Stack, data flow, cost reality |
| 10-build-plan.md | Phased build order and the wedge test |

## Build order in one line

Prove the loop on math first, because math needs no LLM at serve time and is fully verifiable. If a math-only loop does not hook him, more subjects will not fix it. See 10-build-plan.md.
