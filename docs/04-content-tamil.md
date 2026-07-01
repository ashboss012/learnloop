# 04. Content: Tamil

Tamil is a language, so the Duolingo model fits it better than any other subject here. It is also the subject where AI generation is least reliable, because LLMs are weak on Tamil script and grammar. So the rule for Tamil is the opposite of math. Hand-seed the core, let AI assist only at the edges, and review everything.

## Framing

This is heritage-language learning for a young learner, not academic Tamil. Keep the beginner scope tight and concrete. Script, core vocabulary, simple reading, listening if audio is available.

## Why review is mandatory here

An LLM will confidently produce wrong Tamil, wrong script forms, wrong transliterations, unnatural phrasing. There is no cheap code check for "is this correct Tamil" the way there is for arithmetic. So human review is not a safety net here, it is part of the pipeline. Nothing Tamil reaches him unreviewed.

## Build the core by hand

Seed a fixed beginner set by hand for reliability.

- Vowels and consonants (uyir and mei letters), with correct forms
- A starter vocabulary set grouped by theme (family, numbers, colors, food, common verbs)
- Correct transliterations for each item
- Audio where possible (see below)

This hand-seeded set is the backbone. It is small, correct, and trustworthy.

## Where AI helps

Once the core vocabulary and script set exist and are verified, AI can help generate exercise variations over that known-good set. Matching, fill in the blank, ordering, recognition. The vocabulary is fixed and correct, so the AI is only arranging verified items into exercises, not inventing language. Everything still passes through review.

## Question types

- Script recognition (which letter is this)
- Match Tamil word to meaning or image
- Match Tamil word to transliteration
- Fill in the blank from the known vocabulary
- Listening, if audio is available (hear the word, pick the meaning)

## Script and rendering

- Tamil is Unicode, handle it carefully end to end. Store, compare, and render in Tamil script
- Confirm the app font renders Tamil correctly on his device before building content on top of it
- Normalize Unicode so comparisons do not fail on encoding differences

## Audio

Audio makes a language subject much stronger, and it is good for an ADHD learner. Tamil text-to-speech quality is uneven. Options in rough order of quality. Record a small set of core words yourself or with family, which is the most reliable for the seed set. Or use a Tamil TTS service and review each clip. Do not ship audio unreviewed.

## Cost

Small. The core is hand-built once. AI-assisted exercise variation is cheap batch work. Audio cost depends on the route, self-recording is free.

## Not in v1

- Full sentence grammar and conjugation. Start with words and script
- Free-form typing in Tamil script. Use recognition and matching first
