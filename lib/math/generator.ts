import type { Choice } from '@/types'

export interface GeneratedQuestion {
  prompt: string
  choices: Choice[]
  answer: string
  explanation: string
  type: 'multiple_choice'
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildChoices(correct: string, distractors: string[]): Choice[] {
  const seen = new Set<string>([correct])
  const picks: string[] = []
  for (const d of distractors) {
    if (!seen.has(d)) { seen.add(d); picks.push(d) }
    if (picks.length === 3) break
  }

  // Distractor lists can collide (e.g. two fraction distractors reducing to
  // the same value). The fallback below tops up the remaining slots — it
  // must handle every answer shape we produce (plain number, "n/d", "q R r"),
  // not just plain numbers, or it emits "NaN" as a choice.
  const fracMatch = correct.match(/^(\d+)\/(\d+)$/)
  const remMatch = correct.match(/^(\d+) R(\d+)$/)
  let fill = 1
  while (picks.length < 3) {
    let candidate: string
    if (fracMatch) {
      candidate = `${Number(fracMatch[1]) + fill}/${fracMatch[2]}`
    } else if (remMatch) {
      candidate = `${Number(remMatch[1]) + fill} R${remMatch[2]}`
    } else {
      candidate = String(Number(correct) + fill)
    }
    fill++
    if (!seen.has(candidate)) { seen.add(candidate); picks.push(candidate) }
  }
  return shuffle([correct, ...picks]).map(v => ({ label: v, value: v }))
}

function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b) }

function simplify(n: number, d: number): [number, number] {
  const g = gcd(Math.abs(n), d)
  return [n / g, d / g]
}

function frac(n: number, d: number): string {
  return d === 1 ? String(n) : `${n}/${d}`
}

// Multiplication
function genMultiplication(tier: number): GeneratedQuestion {
  let a: number, b: number
  if (tier === 1) { a = randInt(2, 9); b = randInt(2, 9) }
  else if (tier === 2) { a = randInt(10, 99); b = randInt(2, 9) }
  else { a = randInt(10, 49); b = randInt(10, 49) }
  const correct = a * b
  return {
    prompt: `What is ${a} × ${b}?`,
    choices: buildChoices(String(correct), [
      String(correct + 1), String(correct - 1),
      String(a * (b + 1)), String(a + b), String(correct + 10),
    ]),
    answer: String(correct),
    explanation: `${a} × ${b} = ${correct}. Think of ${a} groups of ${b}.`,
    type: 'multiple_choice',
  }
}

// Division
function genDivision(tier: number): GeneratedQuestion {
  const divisor = randInt(2, 9)
  const quotient = randInt(2, tier === 1 ? 9 : 15)
  const remainder = tier === 3 ? randInt(1, divisor - 1) : 0
  const dividend = divisor * quotient + remainder
  if (remainder === 0) {
    return {
      prompt: `What is ${dividend} ÷ ${divisor}?`,
      choices: buildChoices(String(quotient), [
        String(quotient + 1), String(quotient - 1),
        String(quotient + divisor), String(dividend - divisor),
      ]),
      answer: String(quotient),
      explanation: `${dividend} ÷ ${divisor} = ${quotient}. Check: ${divisor} × ${quotient} = ${dividend}.`,
      type: 'multiple_choice',
    }
  }
  const correct = `${quotient} R${remainder}`
  return {
    prompt: `What is ${dividend} ÷ ${divisor}?`,
    choices: buildChoices(correct, [
      `${quotient + 1} R${remainder}`,
      `${quotient} R${remainder + 1}`,
      `${quotient - 1} R${remainder}`,
    ]),
    answer: correct,
    explanation: `${dividend} ÷ ${divisor} = ${quotient} remainder ${remainder}. Check: ${divisor} × ${quotient} + ${remainder} = ${dividend}.`,
    type: 'multiple_choice',
  }
}

// Fractions
function genFractions(tier: number): GeneratedQuestion {
  if (tier === 1) {
    const denom = randInt(3, 10)
    const n1 = randInt(1, denom - 1)
    let n2 = randInt(1, denom - 1)
    while (n2 === n1) n2 = randInt(1, denom - 1)
    const bigger = n1 > n2 ? `${n1}/${denom}` : `${n2}/${denom}`
    const smaller = n1 > n2 ? `${n2}/${denom}` : `${n1}/${denom}`
    return {
      prompt: `Which fraction is larger: ${n1}/${denom} or ${n2}/${denom}?`,
      choices: buildChoices(bigger, [smaller, `${denom}/${n1}`, `${n1 + n2}/${denom}`]),
      answer: bigger,
      explanation: `Same denominator (${denom}), so the bigger numerator wins. ${bigger} is larger.`,
      type: 'multiple_choice',
    }
  }
  if (tier === 2) {
    const denom = randInt(2, 12)
    const n1 = randInt(1, denom - 1)
    const n2 = randInt(1, denom - 1)
    const rawN = n1 + n2
    const [sn, sd] = simplify(rawN, denom)
    const correct = frac(sn, sd)
    return {
      prompt: `${n1}/${denom} + ${n2}/${denom} = ?`,
      choices: buildChoices(correct, [
        frac(rawN, denom * 2), frac(n1 + n2 + 1, denom), frac(n1 * n2, denom),
      ]),
      answer: correct,
      explanation: `Add numerators (same denominator): ${n1}+${n2}=${rawN}, so ${rawN}/${denom}${correct !== `${rawN}/${denom}` ? ` = ${correct}` : ''}.`,
      type: 'multiple_choice',
    }
  }
  const denom = randInt(3, 12)
  const n1 = randInt(2, denom - 1)
  const n2 = randInt(1, n1 - 1)
  const rawN = n1 - n2
  const [sn, sd] = simplify(rawN, denom)
  const correct = frac(sn, sd)
  return {
    prompt: `${n1}/${denom} − ${n2}/${denom} = ?`,
    choices: buildChoices(correct, [
      frac(n1 + n2, denom), frac(rawN + 1, denom), frac(n1, denom),
    ]),
    answer: correct,
    explanation: `Subtract numerators (same denominator): ${n1}−${n2}=${rawN}, so ${rawN}/${denom}${correct !== `${rawN}/${denom}` ? ` = ${correct}` : ''}.`,
    type: 'multiple_choice',
  }
}

// Decimals
function genDecimals(tier: number): GeneratedQuestion {
  if (tier === 1) {
    const whole = randInt(0, 9), tenths = randInt(0, 9), hundredths = randInt(1, 9)
    const num = `${whole}.${tenths}${hundredths}`
    const places = ['ones', 'tenths', 'hundredths']
    const digits = [whole, tenths, hundredths]
    const idx = randInt(0, 2)
    const correct = String(digits[idx])
    return {
      prompt: `In ${num}, what digit is in the ${places[idx]} place?`,
      choices: buildChoices(correct, digits.filter((_, i) => i !== idx).map(String).concat([String(digits[idx] + 1)])),
      answer: correct,
      explanation: `In ${num}: ones=${whole}, tenths=${tenths}, hundredths=${hundredths}. The ${places[idx]} digit is ${correct}.`,
      type: 'multiple_choice',
    }
  }
  if (tier === 2) {
    const af = parseFloat((randInt(1, 9) + randInt(1, 9) * 0.1 + randInt(0, 9) * 0.01).toFixed(2))
    let bf = parseFloat((randInt(1, 9) + randInt(1, 9) * 0.1 + randInt(0, 9) * 0.01).toFixed(2))
    while (bf === af) bf = parseFloat((randInt(1, 9) + randInt(0, 9) * 0.1).toFixed(2))
    const bigger = af > bf ? String(af) : String(bf)
    const smaller = af > bf ? String(bf) : String(af)
    return {
      prompt: `Which decimal is larger: ${af} or ${bf}?`,
      choices: buildChoices(bigger, [smaller, 'They are equal', String(parseFloat(bigger) + 0.1)]),
      answer: bigger,
      explanation: `Compare digit by digit from left to right. ${bigger} > ${smaller}.`,
      type: 'multiple_choice',
    }
  }
  const af = parseFloat((randInt(1, 9) + randInt(0, 9) * 0.1).toFixed(1))
  const bf = parseFloat((randInt(1, 9) + randInt(0, 9) * 0.1).toFixed(1))
  const sum = parseFloat((af + bf).toFixed(1))
  return {
    prompt: `${af} + ${bf} = ?`,
    choices: buildChoices(String(sum), [
      String(parseFloat((sum + 0.1).toFixed(1))),
      String(parseFloat((sum - 0.1).toFixed(1))),
      String(parseFloat(Math.abs(af - bf).toFixed(1))),
    ]),
    answer: String(sum),
    explanation: `Line up the decimal points: ${af} + ${bf} = ${sum}.`,
    type: 'multiple_choice',
  }
}

// Place Value
function genPlaceValue(tier: number): GeneratedQuestion {
  const digits = tier === 1 ? 3 : tier === 2 ? 5 : 6
  const num = randInt(Math.pow(10, digits - 1), Math.pow(10, digits) - 1)
  const places = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands', 'hundred thousands']
  const placeValues = [1, 10, 100, 1000, 10000, 100000]
  const idx = randInt(0, digits - 1)
  const digit = Math.floor(num / placeValues[idx]) % 10
  const display = num.toLocaleString('en-US')

  if (tier < 3) {
    const neighborIdx = idx === digits - 1 ? idx - 1 : idx + 1
    const neighborDigit = Math.floor(num / placeValues[neighborIdx]) % 10
    const correct = String(digit)
    return {
      prompt: `In ${display}, what digit is in the ${places[idx]} place?`,
      choices: buildChoices(correct, [String(neighborDigit), String((digit + 1) % 10), String((digit + 9) % 10)]),
      answer: correct,
      explanation: `In ${display}, the ${places[idx]} digit is ${digit}.`,
      type: 'multiple_choice',
    }
  }

  const value = digit * placeValues[idx]
  const correct = String(value)
  return {
    prompt: `In ${display}, what is the value of the digit ${digit} in the ${places[idx]} place?`,
    choices: buildChoices(correct, [String(digit), String(value * 10), String(value + placeValues[idx])]),
    answer: correct,
    explanation: `The digit ${digit} is in the ${places[idx]} place, so its value is ${digit} × ${placeValues[idx].toLocaleString('en-US')} = ${value.toLocaleString('en-US')}.`,
    type: 'multiple_choice',
  }
}

// Rounding
function genRounding(tier: number): GeneratedQuestion {
  const roundTo = tier === 1 ? 10 : tier === 2 ? 100 : 1000
  const digits = tier === 1 ? 2 : tier === 2 ? 3 : 4
  const num = randInt(Math.pow(10, digits - 1), Math.pow(10, digits) - 1)
  const correct = Math.round(num / roundTo) * roundTo
  const display = num.toLocaleString('en-US')
  const label = roundTo === 10 ? 'ten' : roundTo === 100 ? 'hundred' : 'thousand'
  return {
    prompt: `Round ${display} to the nearest ${label}.`,
    choices: buildChoices(String(correct), [
      String(correct + roundTo), String(correct - roundTo), String(Math.floor(num / roundTo) * roundTo),
    ]),
    answer: String(correct),
    explanation: `${display} rounds to ${correct.toLocaleString('en-US')} (nearest ${label}).`,
    type: 'multiple_choice',
  }
}

// Multi-digit Addition
function genAddition(tier: number): GeneratedQuestion {
  const digits = tier === 1 ? 2 : tier === 2 ? 3 : 4
  const min = Math.pow(10, digits - 1)
  const max = Math.pow(10, digits) - 1
  const a = randInt(min, max)
  const b = randInt(min, max)
  const correct = a + b
  return {
    prompt: `${a.toLocaleString('en-US')} + ${b.toLocaleString('en-US')} = ?`,
    choices: buildChoices(String(correct), [String(correct + 1), String(correct - 1), String(correct + 10)]),
    answer: String(correct),
    explanation: `${a.toLocaleString('en-US')} + ${b.toLocaleString('en-US')} = ${correct.toLocaleString('en-US')}.`,
    type: 'multiple_choice',
  }
}

// Multi-digit Subtraction
function genSubtraction(tier: number): GeneratedQuestion {
  const digits = tier === 1 ? 2 : tier === 2 ? 3 : 4
  const min = Math.pow(10, digits - 1)
  const max = Math.pow(10, digits) - 1
  let a = randInt(min, max)
  let b = randInt(min, max)
  if (b > a) { const tmp = a; a = b; b = tmp }
  const correct = a - b
  return {
    prompt: `${a.toLocaleString('en-US')} − ${b.toLocaleString('en-US')} = ?`,
    choices: buildChoices(String(correct), [String(correct + 1), String(correct - 1), String(correct + 10)]),
    answer: String(correct),
    explanation: `${a.toLocaleString('en-US')} − ${b.toLocaleString('en-US')} = ${correct.toLocaleString('en-US')}.`,
    type: 'multiple_choice',
  }
}

// Factors & Multiples
const COMPOSITE_POOL = [12, 14, 15, 16, 18, 20, 21, 22, 24, 25, 26, 27, 28, 30, 32, 33, 34, 35, 36, 38, 39, 40]

function genFactorsMultiples(tier: number): GeneratedQuestion {
  if (tier === 1) {
    const n = COMPOSITE_POOL[randInt(0, COMPOSITE_POOL.length - 1)]
    const factors: number[] = []
    for (let i = 2; i < n; i++) if (n % i === 0) factors.push(i)
    const factor = factors[randInt(0, factors.length - 1)]
    return {
      prompt: `Which of these numbers is a factor of ${n}?`,
      choices: buildChoices(String(factor), [String(n - 1), String(factor * 2), String(factor + n)]),
      answer: String(factor),
      explanation: `${n} ÷ ${factor} = ${n / factor}, so ${factor} is a factor of ${n}.`,
      type: 'multiple_choice',
    }
  }
  if (tier === 2) {
    const n = randInt(3, 12)
    const k = randInt(3, 9)
    const multiple = n * k
    return {
      prompt: `Which of these numbers is a multiple of ${n}?`,
      choices: buildChoices(String(multiple), [String(multiple + 1), String(multiple - 1), String(multiple + 2)]),
      answer: String(multiple),
      explanation: `${n} × ${k} = ${multiple}, so ${multiple} is a multiple of ${n}.`,
      type: 'multiple_choice',
    }
  }
  const a = randInt(8, 24)
  const b = randInt(8, 24)
  const correct = gcd(a, b)
  return {
    prompt: `What is the greatest common factor of ${a} and ${b}?`,
    choices: buildChoices(String(correct), [String(Math.min(a, b)), String(correct * 2), String(Math.max(1, correct - 1))]),
    answer: String(correct),
    explanation: `The greatest common factor of ${a} and ${b} is ${correct}.`,
    type: 'multiple_choice',
  }
}

// Prime vs Composite
function isPrime(n: number): boolean {
  if (n < 2) return false
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false
  return true
}

function genPrimeComposite(tier: number): GeneratedQuestion {
  const max = tier === 1 ? 20 : tier === 2 ? 50 : 100
  const askPrime = Math.random() < 0.5
  const primes: number[] = []
  const composites: number[] = []
  for (let i = 2; i <= max; i++) (isPrime(i) ? primes : composites).push(i)

  const targetPool = askPrime ? primes : composites
  const otherPool = askPrime ? composites : primes
  const target = targetPool[randInt(0, targetPool.length - 1)]
  const others = shuffle(otherPool).slice(0, 3)

  return {
    prompt: `Which of these numbers is ${askPrime ? 'prime' : 'composite'}?`,
    choices: buildChoices(String(target), others.map(String)),
    answer: String(target),
    explanation: askPrime
      ? `${target} is prime — its only factors are 1 and itself.`
      : `${target} is composite — it has factors besides 1 and itself.`,
    type: 'multiple_choice',
  }
}

// Multiplying by a Fraction
function genFractionMultiplication(tier: number): GeneratedQuestion {
  if (tier === 1) {
    const denom = randInt(2, 8)
    const whole = denom * randInt(1, 6)
    const correct = whole / denom
    return {
      prompt: `1/${denom} × ${whole} = ?`,
      choices: buildChoices(String(correct), [String(correct + 1), String(correct - 1), String(whole)]),
      answer: String(correct),
      explanation: `1/${denom} of ${whole} is ${whole} ÷ ${denom} = ${correct}.`,
      type: 'multiple_choice',
    }
  }
  if (tier === 2) {
    const denom = randInt(3, 8)
    const num = randInt(2, denom - 1)
    const whole = denom * randInt(1, 5)
    const rawProduct = num * whole
    const correct = rawProduct / denom
    return {
      prompt: `${num}/${denom} × ${whole} = ?`,
      choices: buildChoices(String(correct), [String(correct + denom), String(correct - denom), String(num * whole)]),
      answer: String(correct),
      explanation: `${num}/${denom} × ${whole} = (${num} × ${whole}) ÷ ${denom} = ${correct}.`,
      type: 'multiple_choice',
    }
  }
  const denom = randInt(3, 8)
  const num = randInt(2, denom - 1)
  const whole = randInt(2, 9)
  const rawN = num * whole
  const [sn, sd] = simplify(rawN, denom)
  const correct = frac(sn, sd)
  return {
    prompt: `${num}/${denom} × ${whole} = ?`,
    choices: buildChoices(correct, [frac(rawN, denom), frac(rawN + 1, denom), frac(whole, denom)]),
    answer: correct,
    explanation: `${num}/${denom} × ${whole} = ${rawN}/${denom}${correct !== frac(rawN, denom) ? ` = ${correct}` : ''}.`,
    type: 'multiple_choice',
  }
}

// Elapsed Time
function formatTime(totalMinutes: number): string {
  const h24 = Math.floor(totalMinutes / 60) % 24
  const m = totalMinutes % 60
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  const period = h24 < 12 ? 'AM' : 'PM'
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

function genElapsedTime(tier: number): GeneratedQuestion {
  const startMinutes = tier === 1 ? randInt(6, 20) * 60 : randInt(6 * 60, 20 * 60 + 45)
  const elapsed = tier === 1 ? randInt(1, 5) * 60 : tier === 2 ? randInt(1, 8) * 15 : randInt(15, 195)
  const endMinutes = startMinutes + elapsed
  const start = formatTime(startMinutes)
  const end = formatTime(endMinutes)

  return {
    prompt: `It's ${start}. How many minutes until ${end}?`,
    choices: buildChoices(String(elapsed), [String(elapsed + 15), String(elapsed - 15), String(elapsed + 60)]),
    answer: String(elapsed),
    explanation: `From ${start} to ${end} is ${elapsed} minutes${elapsed >= 60 ? ` (${Math.floor(elapsed / 60)} hr ${elapsed % 60} min)` : ''}.`,
    type: 'multiple_choice',
  }
}

export function generateQuestion(slug: string, tier: number): GeneratedQuestion {
  switch (slug) {
    case 'math-multiplication':          return genMultiplication(tier)
    case 'math-division':                return genDivision(tier)
    case 'math-fractions':               return genFractions(tier)
    case 'math-decimals':                return genDecimals(tier)
    case 'math-place-value':             return genPlaceValue(tier)
    case 'math-rounding':                return genRounding(tier)
    case 'math-addition':                return genAddition(tier)
    case 'math-subtraction':             return genSubtraction(tier)
    case 'math-factors-multiples':       return genFactorsMultiples(tier)
    case 'math-prime-composite':         return genPrimeComposite(tier)
    case 'math-fraction-multiplication': return genFractionMultiplication(tier)
    case 'math-elapsed-time':            return genElapsedTime(tier)
    default:                             return genMultiplication(tier)
  }
}
