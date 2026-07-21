import { describe, test, expect } from 'vitest'
import { BOT_ROSTER, botWeeklyXp, getWeekStart } from '@/lib/leaderboard/bots'

const DAY_MS = 24 * 60 * 60 * 1000
const SAMPLES = 200

describe('getWeekStart', () => {
  test(`${SAMPLES} samples — always returns a Monday at or before "now"`, () => {
    for (let i = 0; i < SAMPLES; i++) {
      const now = new Date(Date.now() - Math.floor(Math.random() * 60 * DAY_MS))
      const weekStart = getWeekStart(now)
      expect(weekStart.getUTCDay(), 'week start must be a Monday').toBe(1)
      expect(weekStart.getUTCHours(), 'week start must be at UTC midnight').toBe(0)
      expect(weekStart.getTime(), 'week start must not be after now').toBeLessThanOrEqual(now.getTime())
      expect(now.getTime() - weekStart.getTime(), 'week start must be within 7 days of now').toBeLessThan(7 * DAY_MS)
    }
  })

  test('a fixed known Sunday resolves to the Monday six days earlier', () => {
    // 2026-07-19 is a Sunday (UTC)
    const sunday = new Date('2026-07-19T12:00:00Z')
    const weekStart = getWeekStart(sunday)
    expect(weekStart.toISOString().slice(0, 10)).toBe('2026-07-13')
  })
})

describe('botWeeklyXp', () => {
  for (const bot of BOT_ROSTER) {
    test(`${bot.displayName} (${bot.personality}): is 0 exactly at week start`, () => {
      const weekStart = getWeekStart(new Date('2026-07-13T00:00:00Z'))
      expect(botWeeklyXp(bot, weekStart, weekStart)).toBe(0)
    })

    test(`${bot.displayName} (${bot.personality}): never negative, never exceeds the weekly target`, () => {
      const weekStart = new Date('2026-07-13T00:00:00Z')
      for (let i = 0; i < SAMPLES; i++) {
        const now = new Date(weekStart.getTime() + Math.random() * 8 * DAY_MS) // sample slightly past week end too
        const xp = botWeeklyXp(bot, weekStart, now)
        expect(xp, `xp at ${now.toISOString()}`).toBeGreaterThanOrEqual(0)
        expect(xp, `xp at ${now.toISOString()}`).toBeLessThanOrEqual(bot.weeklyTargetXp)
      }
    })

    test(`${bot.displayName} (${bot.personality}): monotonically non-decreasing as time advances`, () => {
      const weekStart = new Date('2026-07-13T00:00:00Z')
      const timestamps = Array.from({ length: SAMPLES }, () => weekStart.getTime() + Math.random() * 7 * DAY_MS).sort((a, b) => a - b)
      let prev = 0
      for (const t of timestamps) {
        const xp = botWeeklyXp(bot, weekStart, new Date(t))
        expect(xp, `xp dropped at ${new Date(t).toISOString()}`).toBeGreaterThanOrEqual(prev)
        prev = xp
      }
    })
  }

  test('the same bot produces a different curve in a different week (not a static score)', () => {
    const bot = BOT_ROSTER[0]
    const weekA = new Date('2026-07-13T00:00:00Z')
    const weekB = new Date('2026-07-20T00:00:00Z')
    const midWeek = 3 * DAY_MS + 12 * 60 * 60 * 1000 // Thursday noon-ish into the week
    const xpA = botWeeklyXp(bot, weekA, new Date(weekA.getTime() + midWeek))
    const xpB = botWeeklyXp(bot, weekB, new Date(weekB.getTime() + midWeek))
    expect(xpA, 'bot should not produce an identical value every week').not.toBe(xpB)
  })

  test('never reacts to "now" outside the current week in a way that exceeds the target', () => {
    const bot = BOT_ROSTER[0]
    const weekStart = new Date('2026-07-13T00:00:00Z')
    const farFuture = new Date(weekStart.getTime() + 30 * DAY_MS)
    expect(botWeeklyXp(bot, weekStart, farFuture)).toBeLessThanOrEqual(bot.weeklyTargetXp)
  })
})
