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
  let fill = 1
  while (picks.length < 3) {
    const s = String(Number(correct) + fill++)
    if (!seen.has(s)) { seen.add(s); picks.push(s) }
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
    const denom = randInt(2, 10)
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

export function generateQuestion(slug: string, tier: number): GeneratedQuestion {
  switch (slug) {
    case 'math-multiplication': return genMultiplication(tier)
    case 'math-division':       return genDivision(tier)
    case 'math-fractions':      return genFractions(tier)
    case 'math-decimals':       return genDecimals(tier)
    default:                    return genMultiplication(tier)
  }
}
