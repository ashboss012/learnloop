import { describe, test, expect } from 'vitest'
import { startingTier } from '@/lib/mastery'

const SLUGS = ['math-multiplication', 'math-division', 'math-fractions', 'math-decimals']

describe('startingTier', () => {
  test('every grade 1-8 returns a tier in {1,2,3} for every known skill', () => {
    for (const slug of SLUGS) {
      for (let grade = 1; grade <= 8; grade++) {
        expect([1, 2, 3]).toContain(startingTier(slug, grade))
      }
    }
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
