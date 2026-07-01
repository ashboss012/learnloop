# 08. Adaptive Engine (Later)

A later feature. This file exists so that when you build it, you start from real learning science instead of the pop version. Do not build this in v1. The engagement loop already carries most of the benefit.

## The trap to avoid

"Adapt to the student's learning personality" usually means the visual, auditory, kinesthetic learning-styles theory. That theory is not supported by evidence. Controlled studies repeatedly find no learning benefit from matching instruction to a supposed style. If you build the adaptive engine around learning styles, you will spend real effort classifying him into a category that does not predict anything. Skip it.

## What research actually supports

Build adaptivity around mechanisms that hold up in studies.

- Spaced repetition. Re-show material at increasing intervals. Missed items come back sooner, mastered items come back later. Algorithms like Leitner boxes or SM-2 are simple and proven
- Retrieval practice. Learning happens by recalling, not rereading. The loop already does this. Lean into it
- Mastery-based progression. Advance a skill only once performance clears a bar, rather than on a fixed schedule
- Adaptive difficulty. Keep him in the zone where it is challenging but achievable. Too easy is boring, too hard is discouraging, and for an ADHD learner both cause drop-off. Nudge difficulty based on recent accuracy
- Interleaving. Mix skill types within or across sessions rather than long single-skill blocks, once there is enough content to do it well

## ADHD-specific notes

Much of what helps ADHD attention is structural and already in the design. Short sessions, immediate feedback, clear finish lines, low working-memory load, forgiving failure, frequent reward. The adaptive layer should protect those, not override them. Do not let adaptivity produce a session that is long, punishing, or open-ended.

## A simple first version, when you get here

Do not overbuild. Start with two signals from data you already store in session_answers.

1. Per-skill mastery. Track recent accuracy per skill. Below a threshold, keep serving that skill and drop difficulty. Above it, advance
2. Spaced review. Items answered wrong get re-queued sooner in future sessions. Items answered right space out

That is it for a first pass. It uses existing data, needs no new theory, and is honestly most of the value. Add interleaving and finer difficulty control only if the simple version clearly helps him.

## What to measure before trusting any of this

At one user you cannot A/B test. Watch the real signals instead. Does he open it without being told. Session length and completion rate. Whether accuracy on a skill improves over time. Those tell you more than any classifier.
