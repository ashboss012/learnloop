import { describe, test, expect } from 'vitest'
import { calculateCoinsEarned } from '@/lib/coins'

describe('calculateCoinsEarned', () => {
  test('awards the base amount for slow, inaccurate runs', () => {
    expect(calculateCoinsEarned({ accuracy: 0.5, avgSecondsPerQuestion: 60 })).toBe(5)
  })

  test('awards the full accuracy bonus for a perfect run', () => {
    const withPerfect = calculateCoinsEarned({ accuracy: 1, avgSecondsPerQuestion: 60 })
    const withGood = calculateCoinsEarned({ accuracy: 0.8, avgSecondsPerQuestion: 60 })
    expect(withPerfect).toBeGreaterThan(withGood)
    expect(withGood).toBeGreaterThan(5)
  })

  test('awards the fast-speed bonus over the ok-speed bonus', () => {
    const fast = calculateCoinsEarned({ accuracy: 0, avgSecondsPerQuestion: 10 })
    const ok = calculateCoinsEarned({ accuracy: 0, avgSecondsPerQuestion: 30 })
    const slow = calculateCoinsEarned({ accuracy: 0, avgSecondsPerQuestion: 60 })
    expect(fast).toBeGreaterThan(ok)
    expect(ok).toBeGreaterThan(slow)
  })

  test('stacks accuracy and speed bonuses for a fast, perfect run', () => {
    const best = calculateCoinsEarned({ accuracy: 1, avgSecondsPerQuestion: 10 })
    const worst = calculateCoinsEarned({ accuracy: 0, avgSecondsPerQuestion: 90 })
    expect(best).toBe(5 + 8 + 4)
    expect(worst).toBe(5)
  })
})
