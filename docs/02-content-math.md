# 02. Content: Math

Math is the easiest subject to make safe and the right one to build first, because the answer can be computed and checked in code. No LLM is trusted for a math answer, ever.

## The generation pattern

Do not ask an LLM to write a problem and its answer. LLMs get arithmetic wrong. Instead:

1. Define a problem template with parameter ranges. Example, a two-digit by one-digit multiplication template with the first factor from 10 to 99 and the second from 2 to 9.
2. Pick the actual numbers in code.
3. Compute the answer in code. This is ground truth.
4. Optionally use an LLM only for the wrapping, phrasing a word problem around the numbers and writing a plain explanation. The model touches language, never truth.

For many templates you do not need an LLM at all. A word-problem phrasing bank plus slot-filling covers a lot and costs nothing.

## Where the curriculum knowledge comes from

The valuable asset is the sequencing in my head as a Mathnasium instructor, how topics ramp and where kids stall. That is mine and it goes into the templates and their difficulty ordering. It does not come from copying anyone's problem set. We generate original problems from parameters. The math itself is not copyrightable, the specific expression of someone else's problems is, so we simply do not use theirs.

## Skill taxonomy

Organize math into a tree of skills so the loop can pull from a specific skill and difficulty. Implemented shape (lib/math/generator.ts, supabase/migrations/001 + 005):

- Multiplication (single digit, multi digit)
- Division (basic, remainders)
- Fractions (compare, add, subtract — like denominators)
- Decimals (place value, compare, add)
- Place Value (digit identification, digit value, up to hundred-thousands)
- Rounding (nearest ten, hundred, thousand)
- Addition (multi-digit, 2 to 4 digits)
- Subtraction (multi-digit, 2 to 4 digits)
- Factors & Multiples (identify a factor, identify a multiple, greatest common factor)
- Prime & Composite (classify a number)
- Fraction Multiplication (unit fraction × whole, fraction × whole)
- Elapsed Time (minutes between two clock times)

Each skill has 3 difficulty tiers driven by parameter ranges, seeded per-student from grade (lib/mastery.ts) and stepped adaptively per question (see 08).

## Question types

- Direct compute (text input)
- Multiple choice with generated distractors. Generate wrong choices in code using common error patterns, for example off-by-one, wrong operation, place-value slips, so the distractors are pedagogically real
- Word problems (text input or choice)

## Explanations

Explanations can be templated per skill so they are correct by construction. Reserve LLM-written explanations for cases where templating is too rigid, and route those through the review pipeline (see 05) since even explanations can be wrong.

## Cost

Effectively zero. Generation is code. If an LLM is used for phrasing it runs offline in batches, not at serve time.

## Not in v1

- Multi-step word problems — needs a real template/phrasing engine, not just number-swapping
- Geometry, measurement (area/perimeter, angles), and line plots — need a rendered diagram, not just text
- Anything requiring image generation
