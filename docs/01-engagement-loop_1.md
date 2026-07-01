# 01. Engagement Loop

The core of the app. Every subject flows through this loop. If this feels good, the app works. If it does not, nothing else matters.

## The session

A session is a fixed set of questions with a visible finish line. Target 8 to 10 questions, tunable per subject and per user. A session should take 3 to 5 minutes. Short by design, because a short completable task is the thing an ADHD brain can actually start and finish.

Progress is shown as a bar that only moves forward. There is no score, no percentage that can fall, no target number to grind toward. You answer the questions, you finish, you are done.

## Handling a wrong answer

This is the single most important behavior in the app. A wrong answer is never a penalty.

1. Mark it incorrect immediately and show the correct answer with a short explanation.
2. Do not advance the progress bar for that question.
3. Re-queue the question later in the same session so he sees it again.
4. He must answer it correctly at some point to complete the session.

The feeling should be "try again," never "you lost points." He can only move forward, never backward.

## Instant feedback

Every question is graded the moment he answers. Correct shows a quick positive confirmation. Incorrect shows the answer and the why, then continues. No batching, no end-of-quiz reveal. Immediate feedback is one of the few things research clearly supports for attention and learning, and it is what he likes about Duolingo.

## The completion payoff

The end-of-session screen is the dopamine hit. Keep it fast and satisfying.

- XP earned this session
- Streak updated
- A short celebratory animation

XP is the currency that feeds the leaderboard (see 06-leaderboard.md). XP is earned for completing sessions and answering, not lost for mistakes.

## Streaks

A daily streak counts consecutive days with at least one completed session. Consider a small number of streak freezes so one missed day does not nuke weeks of momentum, which for an ADHD user is the difference between a stumble and a quit.

## What lives here vs elsewhere

This file owns the loop mechanics. It does not own where questions come from. Each question arrives as a normalized object (prompt, answer, choices or input type, explanation) regardless of subject. The content files (02, 03, 04) produce that object. The loop just runs it.

## Question object contract

Every subject must hand the loop a question in this shape so the loop stays subject-agnostic.

| Field | Meaning |
|-------|---------|
| id | Unique question id |
| subject | math, english, or tamil |
| skill_id | Which skill or topic this belongs to |
| type | multiple_choice, text_input, matching, etc |
| prompt | The question text or media |
| choices | For choice types, else null |
| answer | The correct answer, already verified upstream |
| explanation | Shown on a wrong answer |

## Not in v1

- No timed modes. Timers add pressure, which is the opposite of the goal
- No hearts or lives that can run out and lock him out
- No competitive real-time play against another live person
