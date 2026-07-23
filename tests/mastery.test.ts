import { describe, test, expect } from 'vitest'
import { startingTier, MAX_TIER } from '@/lib/mastery'

const SLUGS = ['math-multiplication', 'math-division', 'math-fractions', 'math-decimals']

describe('startingTier', () => {
  test('every grade 1-8 returns a tier in {1,2,3,4,5} for every known skill', () => {
    for (const slug of SLUGS) {
      for (let grade = 1; grade <= 8; grade++) {
        expect([1, 2, 3, 4, 5]).toContain(startingTier(slug, grade))
      }
    }
  })

  test('a skill centered at grade 4 spans the full 1-5 range across grades 1-8', () => {
    const seen = new Set(Array.from({ length: 8 }, (_, i) => startingTier('math-multiplication', i + 1)))
    expect(seen).toEqual(new Set([1, 2, 3, 4, 5]))
  })

  test('grade 4 (the old middle) lands on the new middle tier for a grade-4-centered skill', () => {
    expect(startingTier('math-multiplication', 4)).toBe(3)
  })

  test('grade 5 (the old middle) lands on the new middle tier for a grade-5-centered skill', () => {
    expect(startingTier('math-decimals', 5)).toBe(3)
  })

  test('never exceeds MAX_TIER even for a very high grade', () => {
    expect(startingTier('math-multiplication', 12)).toBe(MAX_TIER)
  })

  test('unknown slug falls back to tier 1', () => {
    expect(startingTier('math-geometry', 6)).toBe(1)
  })

  test('tier never decreases as grade increases, per skill', () => {
    for (const slug of SLUGS) {
      let prev = 0
      for (let grade = 1; grade <= 8; grade++) {
        const tier = startingTier(slug, grade)
        expect(tier).toBeGreaterThanOrEqual(prev)
        prev = tier
      }
    }
  })
})
