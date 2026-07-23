import { vi, describe, test, expect, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server')

import { createClient } from '@/lib/supabase/server'
import { checkLeaguePromotion, leagueName, leagueEmoji, scaledBotXp, LEAGUE_XP_MULTIPLIER, MAX_LEAGUE } from '@/lib/leaderboard/leagues'
import { getWeekStart, BOT_ROSTER } from '@/lib/leaderboard/bots'

type MockClient = Awaited<ReturnType<typeof createClient>>
const USER_ID = 'user-1'
const DAY_MS = 24 * 60 * 60 * 1000

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

describe('leagueName / leagueEmoji', () => {
  test('return the right name for each valid league', () => {
    expect(leagueName(1)).toBe('Bronze')
    expect(leagueName(2)).toBe('Silver')
    expect(leagueName(3)).toBe('Gold')
    expect(leagueName(4)).toBe('Platinum')
    expect(leagueName(5)).toBe('Diamond')
  })

  test('clamp out-of-range input instead of throwing', () => {
    expect(leagueName(0)).toBe('Bronze')
    expect(leagueName(99)).toBe('Diamond')
    expect(leagueEmoji(0)).toBe('🥉')
    expect(leagueEmoji(99)).toBe('👑')
  })
})

describe('scaledBotXp', () => {
  test('scales exactly by the league multiplier at a full week elapsed (deterministic: every bot hits its target)', () => {
    const weekStart = getWeekStart(new Date('2026-07-13T00:00:00Z'))
    const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS)
    const bot = BOT_ROSTER[0]
    for (let league = 1; league <= MAX_LEAGUE; league++) {
      const expected = Math.round(bot.weeklyTargetXp * LEAGUE_XP_MULTIPLIER[league - 1])
      expect(scaledBotXp(bot, weekStart, weekEnd, league)).toBe(expected)
    }
  })

  test('higher league multipliers are never smaller (climbing gets harder, not easier)', () => {
    for (let i = 1; i < LEAGUE_XP_MULTIPLIER.length; i++) {
      expect(LEAGUE_XP_MULTIPLIER[i]).toBeGreaterThan(LEAGUE_XP_MULTIPLIER[i - 1])
    }
  })
})

function clientForPromotion({
  currentLeague = 1,
  leagueWeekStart = null as string | null,
  // weekly_xp_by_grade is open-ended ("since this date"), so the promotion
  // check calls it twice (since last week, since this week) and subtracts.
  // Model that here rather than a single userXp.
  xpSinceLastWeek = 0,
  xpSinceThisWeek = 0,
} = {}) {
  const updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) })
  const rpc = vi.fn().mockImplementation((_fn: string, args: { p_week_start: string }) => {
    const lastWeekStr = isoDate(getWeekStart(new Date(getWeekStart().getTime() - DAY_MS)))
    const xp = args.p_week_start === lastWeekStr ? xpSinceLastWeek : xpSinceThisWeek
    return Promise.resolve({ data: [{ user_id: USER_ID, xp }], error: null })
  })
  const tables: Record<string, unknown> = {
    users: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { current_league: currentLeague, league_week_start: leagueWeekStart },
            error: null,
          }),
        }),
      }),
      update: updateFn,
    },
  }
  return {
    from: vi.fn().mockImplementation((table: string) => tables[table] ?? {}),
    rpc,
    _updateFn: updateFn,
    _rpc: rpc,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('checkLeaguePromotion', () => {
  test('first-ever visit (league_week_start null): no promotion evaluated, marks this week', async () => {
    const client = clientForPromotion({ currentLeague: 1, leagueWeekStart: null })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await checkLeaguePromotion(USER_ID, 4)

    expect(result).toEqual({ league: 1, justPromoted: false, previousLeague: null })
    expect(client._rpc).not.toHaveBeenCalled() // nothing to evaluate yet
    expect(client._updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ current_league: 1, league_week_start: isoDate(getWeekStart()) }),
    )
  })

  test('already evaluated this week: no-op, no RPC call, no update', async () => {
    const client = clientForPromotion({ currentLeague: 2, leagueWeekStart: isoDate(getWeekStart()) })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await checkLeaguePromotion(USER_ID, 4)

    expect(result).toEqual({ league: 2, justPromoted: false, previousLeague: null })
    expect(client._rpc).not.toHaveBeenCalled()
    expect(client._updateFn).not.toHaveBeenCalled()
  })

  test('new week, user vastly outranked last week (top 3): promotes one league', async () => {
    const lastWeekStart = isoDate(getWeekStart(new Date(getWeekStart().getTime() - DAY_MS)))
    const client = clientForPromotion({ currentLeague: 1, leagueWeekStart: lastWeekStart, xpSinceLastWeek: 100_000 })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await checkLeaguePromotion(USER_ID, 4)

    expect(result.league).toBe(2)
    expect(result.justPromoted).toBe(true)
    expect(result.previousLeague).toBe(1)
    expect(client._updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ current_league: 2 }),
    )
  })

  test('new week, user far behind (not top 3): no promotion, week still marked evaluated', async () => {
    const lastWeekStart = isoDate(getWeekStart(new Date(getWeekStart().getTime() - DAY_MS)))
    const client = clientForPromotion({ currentLeague: 1, leagueWeekStart: lastWeekStart, xpSinceLastWeek: 0 })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await checkLeaguePromotion(USER_ID, 4)

    expect(result.league).toBe(1)
    expect(result.justPromoted).toBe(false)
    expect(client._updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ current_league: 1, league_week_start: isoDate(getWeekStart()) }),
    )
  })

  test('already at the top league: no further promotion even with a top-3 finish', async () => {
    const lastWeekStart = isoDate(getWeekStart(new Date(getWeekStart().getTime() - DAY_MS)))
    const client = clientForPromotion({ currentLeague: MAX_LEAGUE, leagueWeekStart: lastWeekStart, xpSinceLastWeek: 100_000 })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await checkLeaguePromotion(USER_ID, 4)

    expect(result.league).toBe(MAX_LEAGUE)
    expect(result.justPromoted).toBe(false)
  })

  test('this week\'s already-open-ended XP does not count toward last week\'s evaluation (regression: weekly_xp_by_grade has no upper bound)', async () => {
    const lastWeekStart = isoDate(getWeekStart(new Date(getWeekStart().getTime() - DAY_MS)))
    // "since last week" includes everything through today; "since this
    // week" is almost all of that same total. The difference (last week
    // alone) should be tiny - nowhere near enough to rank top 3.
    const client = clientForPromotion({
      currentLeague: 1,
      leagueWeekStart: lastWeekStart,
      xpSinceLastWeek: 1000,
      xpSinceThisWeek: 999,
    })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await checkLeaguePromotion(USER_ID, 4)

    expect(result.justPromoted).toBe(false)
  })
})
