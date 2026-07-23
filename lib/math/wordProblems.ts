import type { GeneratedQuestion, Choice } from '@/types'

// Multi-step word problems (docs/02's one remaining "not in v1" math item).
// Same trust model as every other math skill: the answer is computed by
// literally evaluating the operations described in the template, in code -
// never an LLM guess. Self-contained on purpose (own randInt/buildChoices),
// so this file can be read start to finish without jumping to generator.ts.

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)]
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Same NaN-safe numeric fallback as lib/math/generator.ts's buildChoices -
// every answer here is a plain integer string, no fractions/remainders.
function buildChoices(correct: string, distractors: string[]): Choice[] {
  const seen = new Set<string>([correct])
  const picks: string[] = []
  for (const d of distractors) {
    if (!seen.has(d)) { seen.add(d); picks.push(d) }
    if (picks.length === 3) break
  }
  let fill = 1
  while (picks.length < 3) {
    const candidate = String(Number(correct) + fill)
    fill++
    if (!seen.has(candidate)) { seen.add(candidate); picks.push(candidate) }
  }
  return shuffle([correct, ...picks]).map(v => ({ label: v, value: v }))
}

const NAMES = ['Maya', 'Leo', 'Zoe', 'Sam', 'Ava', 'Ethan', 'Mia', 'Noah', 'Ella', 'Jack'] as const
const ITEMS = ['apples', 'stickers', 'marbles', 'books', 'cookies', 'pencils', 'shells', 'stamps'] as const

// Tier 1: single-step addition or subtraction.
function tier1(): GeneratedQuestion {
  const name = pick(NAMES)
  const item = pick(ITEMS)
  const isAdd = Math.random() < 0.5
  let a = randInt(10, 60)
  let b = randInt(10, 40)
  if (!isAdd && b > a) { const tmp = a; a = b; b = tmp }

  if (isAdd) {
    const correct = a + b
    return {
      prompt: `${name} has ${a} ${item}. ${name} gets ${b} more ${item}. How many ${item} does ${name} have now?`,
      choices: buildChoices(String(correct), [String(a - b), String(correct + 1), String(correct - 1)]),
      answer: String(correct),
      explanation: `${a} + ${b} = ${correct}.`,
      type: 'multiple_choice',
    }
  }
  const correct = a - b
  return {
    prompt: `${name} has ${a} ${item}. ${name} gives away ${b} ${item}. How many ${item} does ${name} have left?`,
    choices: buildChoices(String(correct), [String(a + b), String(correct + 1), String(correct - 1)]),
    answer: String(correct),
    explanation: `${a} − ${b} = ${correct}.`,
    type: 'multiple_choice',
  }
}

// Tier 2: single-step multiplication.
function tier2(): GeneratedQuestion {
  const name = pick(NAMES)
  const item = pick(ITEMS)
  const bags = randInt(2, 9)
  const perBag = randInt(2, 12)
  const correct = bags * perBag
  return {
    prompt: `${name} buys ${bags} bags of ${item}. Each bag has ${perBag} ${item}. How many ${item} does ${name} have in total?`,
    choices: buildChoices(String(correct), [String(bags + perBag), String(correct + 1), String(correct - 1)]),
    answer: String(correct),
    explanation: `${bags} bags × ${perBag} ${item} each = ${correct} ${item}.`,
    type: 'multiple_choice',
  }
}

// Tier 3: single-step division (exact, no remainder).
function tier3(): GeneratedQuestion {
  const name = pick(NAMES)
  const item = pick(ITEMS)
  const divisor = randInt(2, 12)
  const quotient = randInt(2, 12)
  const dividend = divisor * quotient
  return {
    prompt: `${name} has ${dividend} ${item} and shares them equally among ${divisor} friends. How many ${item} does each friend get?`,
    choices: buildChoices(String(quotient), [String(dividend), String(quotient + 1), String(quotient - 1)]),
    answer: String(quotient),
    explanation: `${dividend} ÷ ${divisor} = ${quotient} ${item} per friend.`,
    type: 'multiple_choice',
  }
}

// Tier 4: two-step - multiply, then subtract.
function tier4(): GeneratedQuestion {
  const name = pick(NAMES)
  const item = pick(ITEMS)
  const boxes = randInt(2, 9)
  const perBox = randInt(2, 12)
  const total = boxes * perBox
  const giveAway = randInt(1, total - 1)
  const correct = total - giveAway
  return {
    prompt: `${name} buys ${boxes} boxes of ${item}. Each box has ${perBox} ${item}. ${name} then gives away ${giveAway} ${item}. How many ${item} does ${name} have left?`,
    choices: buildChoices(String(correct), [String(total), String(boxes + perBox), String(correct + 1)]),
    answer: String(correct),
    explanation: `${boxes} × ${perBox} = ${total} ${item}, then ${total} − ${giveAway} = ${correct} ${item} left.`,
    type: 'multiple_choice',
  }
}

// Tier 5: two-step - divide, then subtract.
function tier5(): GeneratedQuestion {
  const name = pick(NAMES)
  const item = pick(ITEMS)
  const friends = randInt(2, 8)
  const perFriend = randInt(3, 15)
  const total = friends * perFriend
  const giveAway = randInt(1, perFriend - 1)
  const correct = perFriend - giveAway
  return {
    prompt: `${name} has ${total} ${item} and splits them equally among ${friends} friends. Each friend then gives away ${giveAway} ${item}. How many ${item} does each friend have left?`,
    choices: buildChoices(String(correct), [String(perFriend), String(total - giveAway), String(correct + 1)]),
    answer: String(correct),
    explanation: `${total} ÷ ${friends} = ${perFriend} ${item} per friend, then ${perFriend} − ${giveAway} = ${correct} ${item} left.`,
    type: 'multiple_choice',
  }
}

export function generateWordProblem(tier: number): GeneratedQuestion {
  switch (tier) {
    case 1: return tier1()
    case 2: return tier2()
    case 3: return tier3()
    case 4: return tier4()
    default: return tier5()
  }
}
