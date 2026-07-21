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

  // no float artifacts in ANY choice, not just the answer - a distractor
  // built from float math (e.g. parseFloat(x) + 0.1) can produce
  // "5.9799999999999995" even when the answer itself is clean
  for (const v of values) {
    expect(v, `${label}: float artifact in choice "${v}"`).not.toMatch(/\.\d{4,}/)
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

// ── Place Value ───────────────────────────────────────────────────────────────

describe('genPlaceValue', () => {
  const PLACES = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands', 'hundred thousands']
  const PLACE_VALUES = [1, 10, 100, 1000, 10000, 100000]

  for (const tier of [1, 2] as const) {
    test(`tier ${tier}: ${SAMPLES} samples — digit identified correctly`, () => {
      const questions = times(SAMPLES, () => generateQuestion('math-place-value', tier))
      for (const q of questions) {
        const match = q.prompt.match(/In ([\d,]+), what digit is in the ([a-z ]+) place\?/)
        expect(match, 'prompt format mismatch').toBeTruthy()
        const num = parseInt(match![1].replace(/,/g, ''))
        const place = match![2]
        const idx = PLACES.indexOf(place)
        expect(idx, `unknown place name "${place}"`).toBeGreaterThanOrEqual(0)
        const expectedDigit = String(Math.floor(num / PLACE_VALUES[idx]) % 10)
        expect(q.answer, `digit in ${place} of ${num}`).toBe(expectedDigit)
        assertChoiceInvariants(q, `placevalue t${tier} ${num} ${place}`)
      }
    })
  }

  test(`tier 3: ${SAMPLES} samples — digit value identified correctly`, () => {
    const questions = times(SAMPLES, () => generateQuestion('math-place-value', 3))
    for (const q of questions) {
      const match = q.prompt.match(/In ([\d,]+), what is the value of the digit (\d) in the ([a-z ]+) place\?/)
      expect(match, 'prompt format mismatch').toBeTruthy()
      const num = parseInt(match![1].replace(/,/g, ''))
      const digit = parseInt(match![2])
      const place = match![3]
      const idx = PLACES.indexOf(place)
      expect(idx, `unknown place name "${place}"`).toBeGreaterThanOrEqual(0)
      expect(Math.floor(num / PLACE_VALUES[idx]) % 10, 'digit mismatch').toBe(digit)
      const expectedValue = digit * PLACE_VALUES[idx]
      expect(q.answer, `value of digit ${digit} in ${place} of ${num}`).toBe(String(expectedValue))
      assertChoiceInvariants(q, `placevalue t3 ${num} ${place}`)
    }
  })
})

// ── Rounding ──────────────────────────────────────────────────────────────────

describe('genRounding', () => {
  const ROUND_TO = { 1: 10, 2: 100, 3: 1000 } as const

  for (const tier of [1, 2, 3] as const) {
    test(`tier ${tier}: ${SAMPLES} samples — rounds correctly`, () => {
      const questions = times(SAMPLES, () => generateQuestion('math-rounding', tier))
      for (const q of questions) {
        const match = q.prompt.match(/Round ([\d,]+) to the nearest (ten|hundred|thousand)\./)
        expect(match, 'prompt format mismatch').toBeTruthy()
        const num = parseInt(match![1].replace(/,/g, ''))
        const roundTo = ROUND_TO[tier]
        const expected = Math.round(num / roundTo) * roundTo
        expect(parseInt(q.answer), `round ${num} to nearest ${roundTo}`).toBe(expected)
        assertChoiceInvariants(q, `rounding t${tier} ${num}`)
      }
    })
  }
})

// ── Addition ──────────────────────────────────────────────────────────────────

describe('genAddition', () => {
  for (const tier of [1, 2, 3] as const) {
    test(`tier ${tier}: ${SAMPLES} samples all correct`, () => {
      const questions = times(SAMPLES, () => generateQuestion('math-addition', tier))
      const digits = tier === 1 ? 2 : tier === 2 ? 3 : 4
      for (const q of questions) {
        const match = q.prompt.match(/([\d,]+) \+ ([\d,]+) = \?/)
        expect(match, 'prompt format mismatch').toBeTruthy()
        const a = parseInt(match![1].replace(/,/g, '')), b = parseInt(match![2].replace(/,/g, ''))
        expect(parseInt(q.answer), `${a}+${b} answer wrong`).toBe(a + b)
        expect(String(a).length, 'operand a wrong digit count').toBe(digits)
        expect(String(b).length, 'operand b wrong digit count').toBe(digits)
        assertChoiceInvariants(q, `addition t${tier} ${a}+${b}`)
      }
    })
  }
})

// ── Subtraction ───────────────────────────────────────────────────────────────

describe('genSubtraction', () => {
  for (const tier of [1, 2, 3] as const) {
    test(`tier ${tier}: ${SAMPLES} samples all correct, never negative`, () => {
      const questions = times(SAMPLES, () => generateQuestion('math-subtraction', tier))
      const digits = tier === 1 ? 2 : tier === 2 ? 3 : 4
      for (const q of questions) {
        const match = q.prompt.match(/([\d,]+) − ([\d,]+) = \?/)
        expect(match, 'prompt format mismatch').toBeTruthy()
        const a = parseInt(match![1].replace(/,/g, '')), b = parseInt(match![2].replace(/,/g, ''))
        expect(a, 'minuend must be >= subtrahend').toBeGreaterThanOrEqual(b)
        expect(parseInt(q.answer), `${a}-${b} answer wrong`).toBe(a - b)
        expect(String(a).length, 'operand a wrong digit count').toBe(digits)
        assertChoiceInvariants(q, `subtraction t${tier} ${a}-${b}`)
      }
    })
  }
})

// ── Factors & Multiples ──────────────────────────────────────────────────────

describe('genFactorsMultiples', () => {
  test(`tier 1: ${SAMPLES} samples — answer is a genuine factor`, () => {
    const questions = times(SAMPLES, () => generateQuestion('math-factors-multiples', 1))
    for (const q of questions) {
      const match = q.prompt.match(/Which of these numbers is a factor of (\d+)\?/)
      expect(match, 'prompt format mismatch').toBeTruthy()
      const n = parseInt(match![1])
      const factor = parseInt(q.answer)
      expect(n % factor, `${factor} is not a factor of ${n}`).toBe(0)
      expect(factor, 'factor must be > 1').toBeGreaterThan(1)
      expect(factor, 'factor must be < n').toBeLessThan(n)
      assertChoiceInvariants(q, `factors t1 ${n}`)
    }
  })

  test(`tier 2: ${SAMPLES} samples — answer is a genuine multiple`, () => {
    const questions = times(SAMPLES, () => generateQuestion('math-factors-multiples', 2))
    for (const q of questions) {
      const match = q.prompt.match(/Which of these numbers is a multiple of (\d+)\?/)
      expect(match, 'prompt format mismatch').toBeTruthy()
      const n = parseInt(match![1])
      const multiple = parseInt(q.answer)
      expect(multiple % n, `${multiple} is not a multiple of ${n}`).toBe(0)
      assertChoiceInvariants(q, `factors t2 ${n}`)
    }
  })

  test(`tier 3: ${SAMPLES} samples — greatest common factor correct`, () => {
    const questions = times(SAMPLES, () => generateQuestion('math-factors-multiples', 3))
    for (const q of questions) {
      const match = q.prompt.match(/What is the greatest common factor of (\d+) and (\d+)\?/)
      expect(match, 'prompt format mismatch').toBeTruthy()
      const a = parseInt(match![1]), b = parseInt(match![2])
      expect(parseInt(q.answer), `gcf(${a},${b}) wrong`).toBe(gcd(a, b))
      assertChoiceInvariants(q, `factors t3 gcf(${a},${b})`)
    }
  })
})

// ── Prime vs Composite ───────────────────────────────────────────────────────

describe('genPrimeComposite', () => {
  function isPrimeCheck(n: number): boolean {
    if (n < 2) return false
    for (let i = 2; i * i <= n; i++) if (n % i === 0) return false
    return true
  }

  for (const tier of [1, 2, 3] as const) {
    test(`tier ${tier}: ${SAMPLES} samples — classification correct`, () => {
      const questions = times(SAMPLES, () => generateQuestion('math-prime-composite', tier))
      for (const q of questions) {
        const match = q.prompt.match(/Which of these numbers is (prime|composite)\?/)
        expect(match, 'prompt format mismatch').toBeTruthy()
        const askPrime = match![1] === 'prime'
        const target = parseInt(q.answer)
        expect(isPrimeCheck(target), `${target} primality mismatch for "${match![1]}"`).toBe(askPrime)
        assertChoiceInvariants(q, `primecomposite t${tier} ${target}`)
      }
    })
  }
})

// ── Multiplying by a Fraction ────────────────────────────────────────────────

describe('genFractionMultiplication', () => {
  test(`tier 1: ${SAMPLES} samples — unit fraction times whole number`, () => {
    const questions = times(SAMPLES, () => generateQuestion('math-fraction-multiplication', 1))
    for (const q of questions) {
      const match = q.prompt.match(/1\/(\d+) × (\d+) = \?/)
      expect(match, 'prompt format mismatch').toBeTruthy()
      const denom = parseInt(match![1]), whole = parseInt(match![2])
      expect(whole % denom, `${whole} not divisible by ${denom}`).toBe(0)
      expect(parseInt(q.answer), `1/${denom} × ${whole} wrong`).toBe(whole / denom)
      assertChoiceInvariants(q, `fracmult t1 1/${denom}×${whole}`)
    }
  })

  test(`tier 2: ${SAMPLES} samples — non-unit fraction times whole number, whole result`, () => {
    const questions = times(SAMPLES, () => generateQuestion('math-fraction-multiplication', 2))
    for (const q of questions) {
      const match = q.prompt.match(/(\d+)\/(\d+) × (\d+) = \?/)
      expect(match, 'prompt format mismatch').toBeTruthy()
      const num = parseInt(match![1]), denom = parseInt(match![2]), whole = parseInt(match![3])
      expect((num * whole) % denom, `${num}×${whole} not divisible by ${denom}`).toBe(0)
      expect(parseInt(q.answer), `${num}/${denom} × ${whole} wrong`).toBe((num * whole) / denom)
      assertChoiceInvariants(q, `fracmult t2 ${num}/${denom}×${whole}`)
    }
  })

  test(`tier 3: ${SAMPLES} samples — fraction result correct and simplified`, () => {
    const questions = times(SAMPLES, () => generateQuestion('math-fraction-multiplication', 3))
    for (const q of questions) {
      const match = q.prompt.match(/(\d+)\/(\d+) × (\d+) = \?/)
      expect(match, 'prompt format mismatch').toBeTruthy()
      const num = parseInt(match![1]), denom = parseInt(match![2]), whole = parseInt(match![3])
      const rawN = num * whole
      const [sn, sd] = simplifyFrac(rawN, denom)
      const expected = fracStr(sn, sd)
      expect(q.answer, `${num}/${denom} × ${whole} wrong`).toBe(expected)
      assertChoiceInvariants(q, `fracmult t3 ${num}/${denom}×${whole}`)
    }
  })
})

// ── Elapsed Time ──────────────────────────────────────────────────────────────

describe('genElapsedTime', () => {
  function parseClock(s: string): number {
    const m = s.match(/(\d+):(\d+) (AM|PM)/)
    if (!m) throw new Error(`bad time string: ${s}`)
    let h = parseInt(m[1]) % 12
    if (m[3] === 'PM') h += 12
    return h * 60 + parseInt(m[2])
  }

  for (const tier of [1, 2, 3] as const) {
    test(`tier ${tier}: ${SAMPLES} samples — elapsed minutes correct`, () => {
      const questions = times(SAMPLES, () => generateQuestion('math-elapsed-time', tier))
      for (const q of questions) {
        const match = q.prompt.match(/It's (\d+:\d+ (?:AM|PM))\. How many minutes until (\d+:\d+ (?:AM|PM))\?/)
        expect(match, 'prompt format mismatch').toBeTruthy()
        const startMin = parseClock(match![1])
        const endMin = parseClock(match![2])
        const elapsed = parseInt(q.answer)
        // handle possible day wraparound (end time earlier in the day than start)
        const wrapped = endMin >= startMin ? endMin - startMin : endMin + 1440 - startMin
        expect(wrapped, `elapsed time mismatch for ${match![1]} -> ${match![2]}`).toBe(elapsed)
        expect(elapsed, 'elapsed must be positive').toBeGreaterThan(0)
        assertChoiceInvariants(q, `elapsedtime t${tier} ${match![1]}->${match![2]}`)
      }
    })
  }
})
