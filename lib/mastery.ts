// Starting-tier seed for user_skill_progress.
//
// Not a placement test - just a reasonable default so a student's very
// first question in a skill isn't randomly too easy or too hard. The
// per-question tier stepping in app/actions/session.ts takes over
// immediately after. Bands are generic, widely-known grade-level
// expectations, not sourced from any copyrighted test:
//
//  - multiplication/division fluency: expected by end of grade 4
//  - comparing like-denominator fractions: grade 3; add/subtract: grade 4-5
//  - decimal place value: grade 4; compare/add decimals: grade 5
//
// Widened from a 1-3 to a 1-5 scale so students beyond the old grade-5+
// ceiling actually get differentiated difficulty instead of all landing
// on the same max tier. Each skill keeps its previous "center" grade (the
// old tier2/tier3 boundary) as the new middle tier and spreads two more
// steps on each side - a mechanical widen, not new pedagogical judgment.

export type Tier = 1 | 2 | 3 | 4 | 5
export const MAX_TIER: Tier = 5

function bandCenteredAt(center: number): (grade: number) => Tier {
  return grade => {
    if (grade <= center - 2) return 1
    if (grade === center - 1) return 2
    if (grade === center) return 3
    if (grade === center + 1) return 4
    return 5
  }
}

const GRADE_BANDS: Record<string, (grade: number) => Tier> = {
  'math-multiplication':          bandCenteredAt(4),
  'math-division':                bandCenteredAt(4),
  'math-fractions':               bandCenteredAt(4),
  'math-decimals':                bandCenteredAt(5),
  'math-place-value':             bandCenteredAt(4),
  'math-rounding':                bandCenteredAt(4),
  'math-addition':                bandCenteredAt(4),
  'math-subtraction':             bandCenteredAt(4),
  // Factors, primality, and multiplying fractions by whole numbers are
  // CCSS 5th-grade content - centered one grade later than the core
  // arithmetic-fluency skills above.
  'math-factors-multiples':       bandCenteredAt(5),
  'math-prime-composite':         bandCenteredAt(5),
  'math-fraction-multiplication': bandCenteredAt(5),
  'math-elapsed-time':            bandCenteredAt(4),
  'math-word-problems':           bandCenteredAt(4),
  // Grammar/vocabulary fluency skills - same grade-appropriate band as
  // the arithmetic-fluency math skills above.
  'english-parts-of-speech':          bandCenteredAt(4),
  'english-subject-verb-agreement':   bandCenteredAt(4),
  'english-tenses':                   bandCenteredAt(4),
  'english-punctuation':              bandCenteredAt(4),
  'english-capitalization':           bandCenteredAt(4),
  'english-plurals':                  bandCenteredAt(4),
  'english-vocabulary':               bandCenteredAt(4),
}

export function startingTier(slug: string, grade: number): Tier {
  const band = GRADE_BANDS[slug]
  if (!band) return 1
  return Math.min(MAX_TIER, Math.max(1, band(grade))) as Tier
}
