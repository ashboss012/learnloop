import { describe, test, expect } from 'vitest'
import { generateWordProblem } from '@/lib/math/wordProblems'

// Independent copies, not imports from lib/math/wordProblems.ts - the point
// is to catch a mistake in the generator's own pools, not just confirm the
// generator agrees with itself.
const NAMES = ['Maya', 'Leo', 'Zoe', 'Sam', 'Ava', 'Ethan', 'Mia', 'Noah', 'Ella', 'Jack']
const ITEMS = ['apples', 'stickers', 'marbles', 'books', 'cookies', 'pencils', 'shells', 'stamps']

function times<T>(n: number, fn: () => T): T[] {
  return Array.from({ length: n }, fn)
}

const SAMPLES = 500

function assertChoiceInvariants(q: ReturnType<typeof generateWordProblem>, label: string) {
  const values = q.choices.map(c => c.value)
  expect(values.filter(v => v === q.answer).length, `${label}: answer appears != 1 time`).toBe(1)
  expect(new Set(values).size, `${label}: duplicate choices`).toBe(4)
  for (const v of values) {
    expect(v, `${label}: NaN/undefined choice`).not.toBe('NaN')
    expect(v, `${label}: NaN/undefined choice`).not.toBe('undefined')
  }
  expect(q.explanation.trim().length, `${label}: empty explanation`).toBeGreaterThan(0)
  expect(NAMES, `${label}: name not from known pool`).toContain(q.prompt.match(/^(\w+)/)![1])
}

describe('generateWordProblem', () => {
  test(`tier 1: ${SAMPLES} samples — single-step addition or subtraction, always correct`, () => {
    const questions = times(SAMPLES, () => generateWordProblem(1))
    const seenOps = new Set<string>()
    for (const q of questions) {
      const addMatch = q.prompt.match(/^(\w+) has (\d+) ([a-z]+)\. \1 gets (\d+) more \3\. How many \3 does \1 have now\?$/)
      const subMatch = q.prompt.match(/^(\w+) has (\d+) ([a-z]+)\. \1 gives away (\d+) \3\. How many \3 does \1 have left\?$/)
      expect(addMatch || subMatch, `prompt format mismatch: "${q.prompt}"`).toBeTruthy()

      const item = (addMatch ?? subMatch)![3]
      expect(ITEMS, 'item not from known pool').toContain(item)

      if (addMatch) {
        seenOps.add('add')
        const a = parseInt(addMatch[2]), b = parseInt(addMatch[4])
        expect(q.answer, `${a}+${b}`).toBe(String(a + b))
      } else {
        seenOps.add('subtract')
        const a = parseInt(subMatch![2]), b = parseInt(subMatch![4])
        expect(a, 'minuend must be >= subtrahend').toBeGreaterThanOrEqual(b)
        expect(q.answer, `${a}-${b}`).toBe(String(a - b))
      }

      assertChoiceInvariants(q, `wordproblems t1 "${q.prompt}"`)
    }
    expect(seenOps.size, `${SAMPLES} samples should exercise both addition and subtraction`).toBe(2)
  })

  test(`tier 2: ${SAMPLES} samples — single-step multiplication, always correct`, () => {
    const questions = times(SAMPLES, () => generateWordProblem(2))
    for (const q of questions) {
      const match = q.prompt.match(/^(\w+) buys (\d+) bags of ([a-z]+)\. Each bag has (\d+) \3\. How many \3 does \1 have in total\?$/)
      expect(match, `prompt format mismatch: "${q.prompt}"`).toBeTruthy()
      expect(ITEMS, 'item not from known pool').toContain(match![3])
      const bags = parseInt(match![2]), perBag = parseInt(match![4])
      expect(bags).toBeGreaterThanOrEqual(2); expect(bags).toBeLessThanOrEqual(9)
      expect(perBag).toBeGreaterThanOrEqual(2); expect(perBag).toBeLessThanOrEqual(12)
      expect(q.answer, `${bags}×${perBag}`).toBe(String(bags * perBag))
      assertChoiceInvariants(q, `wordproblems t2 "${q.prompt}"`)
    }
  })

  test(`tier 3: ${SAMPLES} samples — single-step exact division, always correct`, () => {
    const questions = times(SAMPLES, () => generateWordProblem(3))
    for (const q of questions) {
      const match = q.prompt.match(/^(\w+) has (\d+) ([a-z]+) and shares them equally among (\d+) friends\. How many \3 does each friend get\?$/)
      expect(match, `prompt format mismatch: "${q.prompt}"`).toBeTruthy()
      expect(ITEMS, 'item not from known pool').toContain(match![3])
      const dividend = parseInt(match![2]), divisor = parseInt(match![4])
      expect(dividend % divisor, `${dividend} not divisible by ${divisor}`).toBe(0)
      expect(q.answer, `${dividend}÷${divisor}`).toBe(String(dividend / divisor))
      assertChoiceInvariants(q, `wordproblems t3 "${q.prompt}"`)
    }
  })

  test(`tier 4: ${SAMPLES} samples — two-step multiply-then-subtract, always correct`, () => {
    const questions = times(SAMPLES, () => generateWordProblem(4))
    for (const q of questions) {
      const match = q.prompt.match(/^(\w+) buys (\d+) boxes of ([a-z]+)\. Each box has (\d+) \3\. \1 then gives away (\d+) \3\. How many \3 does \1 have left\?$/)
      expect(match, `prompt format mismatch: "${q.prompt}"`).toBeTruthy()
      expect(ITEMS, 'item not from known pool').toContain(match![3])
      const boxes = parseInt(match![2]), perBox = parseInt(match![4]), giveAway = parseInt(match![5])
      const total = boxes * perBox
      expect(giveAway, 'giveAway must be > 0').toBeGreaterThan(0)
      expect(giveAway, 'giveAway must be < total').toBeLessThan(total)
      expect(q.answer, `${total}-${giveAway}`).toBe(String(total - giveAway))
      assertChoiceInvariants(q, `wordproblems t4 "${q.prompt}"`)
    }
  })

  test(`tier 5: ${SAMPLES} samples — two-step divide-then-subtract, always correct`, () => {
    const questions = times(SAMPLES, () => generateWordProblem(5))
    for (const q of questions) {
      const match = q.prompt.match(/^(\w+) has (\d+) ([a-z]+) and splits them equally among (\d+) friends\. Each friend then gives away (\d+) \3\. How many \3 does each friend have left\?$/)
      expect(match, `prompt format mismatch: "${q.prompt}"`).toBeTruthy()
      expect(ITEMS, 'item not from known pool').toContain(match![3])
      const total = parseInt(match![2]), friends = parseInt(match![4]), giveAway = parseInt(match![5])
      expect(total % friends, `${total} not divisible by ${friends}`).toBe(0)
      const perFriend = total / friends
      expect(giveAway, 'giveAway must be > 0').toBeGreaterThan(0)
      expect(giveAway, 'giveAway must be < perFriend').toBeLessThan(perFriend)
      expect(q.answer, `${perFriend}-${giveAway}`).toBe(String(perFriend - giveAway))
      assertChoiceInvariants(q, `wordproblems t5 "${q.prompt}"`)
    }
  })
})
