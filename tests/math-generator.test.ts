import { describe, test, expect } from 'vitest'
import { generateQuestion } from '@/lib/math/generator'

// ── helpers ──────────────────────────────────────────────────────────────────

function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b) }

function simplifyFrac(n: number, d: number): [number, number] {
  const g = gcd(Math.abs(n), d)
  return [n / g, d / g]
}

function fracStr(n: number, d: number): string {
  return d === 1 ? String(n) : `${n}/${d}`
}

/** Run `fn` N times and collect results. */
function times<T>(n: number, fn: () => T): T[] {
  return Array.from({ length: n }, fn)
}

const SAMPLES = 500

// ── shared choice-level assertions (apply to every question) ─────────────────

function assertChoiceInvariants(q: ReturnType<typeof generateQuestion>, label: string) {
  const values = q.choices.map(c => c.value)

  // correct answer appears exactly once
  expect(values.filter(v => v === q.answer).length, `${label}: answer appears != 1 time`).toBe(1)

  // no duplicate choice values
  expect(new Set(values).size, `${label}: duplicate choices`).toBe(4)

  // no NaN or undefined distractors (catches the buildChoices NaN fallback bug)
  for (const v of values) {
    expect(v, `${label}: NaN/undefined choice`).not.toBe('NaN')
    expect(v, `${label}: NaN/undefined choice`).not.toBe('undefined')
    expect(v, `${label}: NaN/undefined choice`).not.toMatch(/^NaN/)
  }

  // explanation is non-empty
  expect(q.explanation.trim().length, `${label}: empty explanation`).toBeGreaterThan(0)
}

// ── Multiplication ────────────────────────────────────────────────────────────

describe('genMultiplication', () => {
  for (const tier of [1, 2, 3] as const) {
    test(`tier ${tier}: ${SAMPLES} samples all correct`, () => {
      const questions = times(SAMPLES, () => generateQuestion('math-multiplication', tier))

      for (const q of questions) {
        const match = q.prompt.match(/What is (\d+) × (\d+)\?/)
        expect(match, 'prompt format mismatch').toBeTruthy()
        const a = parseInt(match![1]), b = parseInt(match![2])

        // independent verification
        expect(parseInt(q.answer), `${a}×${b} answer wrong`).toBe(a * b)

        // tier ranges
        if (tier === 1) {
          expect(a).toBeGreaterThanOrEqual(2); expect(a).toBeLessThanOrEqual(9)
          expect(b).toBeGreaterThanOrEqual(2); expect(b).toBeLessThanOrEqual(9)
        } else if (tier === 2) {
          expect(a).toBeGreaterThanOrEqual(10); expect(a).toBeLessThanOrEqual(99)
          expect(b).toBeGreaterThanOrEqual(2);  expect(b).toBeLessThanOrEqual(9)
        } else {
          expect(a).toBeGreaterThanOrEqual(10); expect(a).toBeLessThanOrEqual(49)
          expect(b).toBeGreaterThanOrEqual(10); expect(b).toBeLessThanOrEqual(49)
        }

        assertChoiceInvariants(q, `mult t${tier} ${a}×${b}`)
      }
    })
  }
})

// ── Division ─────────────────────────────────────────────────────────────────

describe('genDivision', () => {
  for (const tier of [1, 2, 3] as const) {
    test(`tier ${tier}: ${SAMPLES} samples all correct`, () => {
      const questions = times(SAMPLES, () => generateQuestion('math-division', tier))

      for (const q of questions) {
        const match = q.prompt.match(/What is (\d+) ÷ (\d+)\?/)
        expect(match, 'prompt format mismatch').toBeTruthy()
        const dividend = parseInt(match![1]), divisor = parseInt(match![2])

        // divisor never zero
        expect(divisor, 'divisor is zero').toBeGreaterThan(0)

        if (q.answer.includes('R')) {
          // remainder form: "Q RR"
          const parts = q.answer.split(' R')
          expect(parts.length, 'bad remainder format').toBe(2)
          const quotient = parseInt(parts[0]), remainder = parseInt(parts[1])

          // independent verification: divisor × quotient + remainder = dividend
          expect(divisor * quotient + remainder, `${dividend}÷${divisor} check failed`).toBe(dividend)

          // remainder must be in (0, divisor)
          expect(remainder, 'remainder must be > 0').toBeGreaterThan(0)
          expect(remainder, 'remainder must be < divisor').toBeLessThan(divisor)

          // only tier 3 produces remainders
          expect(tier, 'remainder on non-tier-3').toBe(3)
        } else {
          // exact division
          expect(dividend % divisor, `${dividend} not divisible by ${divisor}`).toBe(0)
          expect(parseInt(q.answer), `${dividend}÷${divisor} answer wrong`).toBe(dividend / divisor)
        }

        assertChoiceInvariants(q, `div t${tier} ${dividend}÷${divisor}`)
      }
    })
  }
})

// ── Fractions ─────────────────────────────────────────────────────────────────

describe('genFractions', () => {
  test(`tier 1: ${SAMPLES} samples — larger fraction identified correctly`, () => {
    const questions = times(SAMPLES, () => generateQuestion('math-fractions', 1))

    for (const q of questions) {
      const match = q.prompt.match(/Which fraction is larger: (\d+)\/(\d+) or (\d+)\/(\d+)\?/)
      expect(match, 'prompt format mismatch').toBeTruthy()
      const n1 = parseInt(match![1]), denom = parseInt(match![2])
      const n2 = parseInt(match![3])

      // same denominator — larger numerator wins
      const expectedBigger = n1 > n2 ? `${n1}/${denom}` : `${n2}/${denom}`
      expect(q.answer, `larger fraction wrong for ${n1}/${denom} vs ${n2}/${denom}`).toBe(expectedBigger)

      // denominator in range [2, 10]
      expect(denom).toBeGreaterThanOrEqual(2)
      expect(denom).toBeLessThanOrEqual(10)

      // numerators differ (guaranteed by generator loop)
      expect(n1, 'numerators must differ').not.toBe(n2)

      assertChoiceInvariants(q, `frac t1 ${n1}/${denom} vs ${n2}/${denom}`)
    }
  })

  test(`tier 2: ${SAMPLES} samples — fraction addition correct and simplified`, () => {
    const questions = times(SAMPLES, () => generateQuestion('math-fractions', 2))

    for (const q of questions) {
      const match = q.prompt.match(/(\d+)\/(\d+) \+ (\d+)\/(\d+) = \?/)
      expect(match, 'prompt format mismatch').toBeTruthy()
      const n1 = parseInt(match![1]), denom = parseInt(match![2]), n2 = parseInt(match![3])

      // independent verification
      const rawN = n1 + n2
      const [sn, sd] = simplifyFrac(rawN, denom)
      const expected = fracStr(sn, sd)
      expect(q.answer, `${n1}/${denom}+${n2}/${denom} wrong`).toBe(expected)

      // float: answer must not contain float artifacts
      if (q.answer.includes('.')) {
        expect(q.answer).not.toMatch(/\.\d{4,}/)
      }

      assertChoiceInvariants(q, `frac t2 ${n1}/${denom}+${n2}/${denom}`)
    }
  })

  test(`tier 3: ${SAMPLES} samples — fraction subtraction correct and simplified`, () => {
    const questions = times(SAMPLES, () => generateQuestion('math-fractions', 3))

    for (const q of questions) {
      // tier 3 uses minus sign (−, U+2212)
      const match = q.prompt.match(/(\d+)\/(\d+) − (\d+)\/(\d+) = \?/)
      expect(match, 'prompt format mismatch').toBeTruthy()
      const n1 = parseInt(match![1]), denom = parseInt(match![2]), n2 = parseInt(match![3])

      // n1 > n2 always (generator ensures this — result always positive)
      expect(n1, 'n1 should be > n2 to ensure positive result').toBeGreaterThan(n2)

      // independent verification
      const rawN = n1 - n2
      const [sn, sd] = simplifyFrac(rawN, denom)
      const expected = fracStr(sn, sd)
      expect(q.answer, `${n1}/${denom}-${n2}/${denom} wrong`).toBe(expected)

      assertChoiceInvariants(q, `frac t3 ${n1}/${denom}-${n2}/${denom}`)
    }
  })
})

// ── Decimals ──────────────────────────────────────────────────────────────────

describe('genDecimals', () => {
  test(`tier 1: ${SAMPLES} samples — correct digit identified`, () => {
    const questions = times(SAMPLES, () => generateQuestion('math-decimals', 1))

    for (const q of questions) {
      const match = q.prompt.match(/In (\d+\.\d+), what digit is in the (\w+) place\?/)
      expect(match, 'prompt format mismatch').toBeTruthy()
      const numStr = match![1], place = match![2]
      const [wholePart, decPart] = numStr.split('.')

      const expectedDigit = place === 'ones'
        ? wholePart
        : place === 'tenths'
          ? decPart[0]
          : decPart[1]  // hundredths

      expect(q.answer, `digit in ${place} of ${numStr}`).toBe(expectedDigit)
      assertChoiceInvariants(q, `dec t1 ${numStr} ${place}`)
    }
  })

  test(`tier 2: ${SAMPLES} samples — larger decimal identified correctly, no float artifacts`, () => {
    const questions = times(SAMPLES, () => generateQuestion('math-decimals', 2))

    for (const q of questions) {
      const match = q.prompt.match(/Which decimal is larger: ([\d.]+) or ([\d.]+)\?/)
      expect(match, 'prompt format mismatch').toBeTruthy()
      const af = parseFloat(match![1]), bf = parseFloat(match![2])

      // independent verification — they must differ (generator enforces this)
      expect(af, 'decimals must differ').not.toBe(bf)

      const expectedBigger = af > bf ? String(af) : String(bf)
      expect(q.answer, `larger of ${af} vs ${bf}`).toBe(expectedBigger)

      // no float artifacts in the answer
      expect(q.answer, 'float artifact in answer').not.toMatch(/\.\d{5,}/)

      assertChoiceInvariants(q, `dec t2 ${af} vs ${bf}`)
    }
  })

  test(`tier 3: ${SAMPLES} samples — decimal addition correct, no float artifacts`, () => {
    const questions = times(SAMPLES, () => generateQuestion('math-decimals', 3))

    for (const q of questions) {
      const match = q.prompt.match(/([\d.]+) \+ ([\d.]+) = \?/)
      expect(match, 'prompt format mismatch').toBeTruthy()
      const af = parseFloat(match![1]), bf = parseFloat(match![2])

      // independent verification: round to 1 decimal (same as generator)
      const expected = String(parseFloat((af + bf).toFixed(1)))
      expect(q.answer, `${af}+${bf} decimal sum wrong`).toBe(expected)

      // EXPLICIT FLOAT TEST: answer must not be a raw JS float artifact
      // e.g. "0.30000000000000004" would fail this
      expect(q.answer, 'float artifact in answer').not.toMatch(/\.\d{4,}/)

      // answer has at most 1 decimal place (tier 3 always sums 1-dp numbers)
      if (q.answer.includes('.')) {
        expect(q.answer.split('.')[1].length, 'too many decimal places').toBeLessThanOrEqual(1)
      }

      assertChoiceInvariants(q, `dec t3 ${af}+${bf}`)
    }
  })
})
