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

export type Tier = 1 | 2 | 3

const GRADE_BANDS: Record<string, (grade: number) => Tier> = {
  'math-multiplication':          grade => (grade <= 3 ? 1 : grade === 4 ? 2 : 3),
  'math-division':                grade => (grade <= 3 ? 1 : grade === 4 ? 2 : 3),
  'math-fractions':                grade => (grade <= 3 ? 1 : grade <= 4 ? 2 : 3),
  'math-decimals':                grade => (grade <= 4 ? 1 : grade === 5 ? 2 : 3),
  'math-place-value':             grade => (grade <= 3 ? 1 : grade === 4 ? 2 : 3),
  'math-rounding':                grade => (grade <= 3 ? 1 : grade === 4 ? 2 : 3),
  'math-addition':                grade => (grade <= 3 ? 1 : grade === 4 ? 2 : 3),
  'math-subtraction':             grade => (grade <= 3 ? 1 : grade === 4 ? 2 : 3),
  // Factors, primality, and multiplying fractions by whole numbers are
  // CCSS 5th-grade content — a 4th grader should start at tier 1 here
  // even though tier 1 for arithmetic fluency skills above is grade <= 3.
  'math-factors-multiples':       grade => (grade <= 4 ? 1 : grade === 5 ? 2 : 3),
  'math-prime-composite':         grade => (grade <= 4 ? 1 : grade === 5 ? 2 : 3),
  'math-fraction-multiplication': grade => (grade <= 4 ? 1 : grade === 5 ? 2 : 3),
  'math-elapsed-time':            grade => (grade <= 3 ? 1 : grade === 4 ? 2 : 3),
}

export function startingTier(slug: string, grade: number): Tier {
  const band = GRADE_BANDS[slug]
  if (!band) return 1
  return Math.min(3, Math.max(1, band(grade))) as Tier
}
