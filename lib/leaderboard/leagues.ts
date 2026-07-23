import { createClient } from '@/lib/supabase/server'
import { BOT_ROSTER, botWeeklyXp, getWeekStart } from '@/lib/leaderboard/bots'

// Promotion-only leagues: top 3 in the weekly board advances one league,
// no demotion - matches the app's "no punishment" philosophy (docs/08's
// ADHD notes) and what was actually asked for. The underlying board (same
// bots, same weekly XP mechanic) is unchanged; a league only does two
// things: scales bot difficulty up a bit as you climb, and gets evaluated
// once per new week against last week's result.
export const LEAGUE_NAMES = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'] as const
export const LEAGUE_EMOJI = ['🥉', '🥈', '🥇', '💎', '👑'] as const
export const MAX_LEAGUE = LEAGUE_NAMES.length
const PROMOTION_CUTOFF = 3
const DAY_MS = 24 * 60 * 60 * 1000

// Same bot roster every league - only the difficulty (how much of their
// weekly target they're credited with) scales, so climbing actually gets
// harder without needing a separate bot pool per league.
export const LEAGUE_XP_MULTIPLIER = [0.7, 0.85, 1.0, 1.15, 1.3] as const

function clampLeague(league: number): number {
  return Math.min(Math.max(league, 1), MAX_LEAGUE)
}

export function leagueName(league: number): string {
  return LEAGUE_NAMES[clampLeague(league) - 1]
}

export function leagueEmoji(league: number): string {
  return LEAGUE_EMOJI[clampLeague(league) - 1]
}

export function scaledBotXp(bot: (typeof BOT_ROSTER)[number], weekStart: Date, now: Date, league: number): number {
  const multiplier = LEAGUE_XP_MULTIPLIER[clampLeague(league) - 1]
  return Math.round(botWeeklyXp(bot, weekStart, now) * multiplier)
}

interface PromotionResult {
  league: number
  justPromoted: boolean
  previousLeague: number | null
}

// Called once per leaderboard page load. Idempotent via league_week_start -
// only actually evaluates a promotion the first time it's called after a
// new week has started, and never re-evaluates the same transition twice.
// No cron job, same "compute it live" approach as the bots.
export async function checkLeaguePromotion(userId: string, grade: number): Promise<PromotionResult> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('users')
    .select('current_league, league_week_start')
    .eq('id', userId)
    .single()

  const currentLeague = profile?.current_league ?? 1
  const thisWeekStart = getWeekStart()
  const thisWeekStartStr = thisWeekStart.toISOString().slice(0, 10)

  if (profile?.league_week_start && profile.league_week_start >= thisWeekStartStr) {
    return { league: currentLeague, justPromoted: false, previousLeague: null }
  }

  let nextLeague = currentLeague
  let justPromoted = false

  // Only evaluate a promotion if there's a previous week on record - skip
  // on the very first-ever leaderboard visit, nothing to judge yet.
  if (profile?.league_week_start) {
    const lastWeekStart = getWeekStart(new Date(thisWeekStart.getTime() - DAY_MS))
    const lastWeekStartStr = lastWeekStart.toISOString().slice(0, 10)
    const lastWeekEnd = new Date(lastWeekStart.getTime() + 7 * DAY_MS)

    // weekly_xp_by_grade(p_week_start) is open-ended ("XP since that date"),
    // not a bounded week - it was built for "since the current week began"
    // where there's no upper bound to worry about. Isolating last week's
    // XP alone means subtracting off whatever's accumulated since this
    // week started.
    const [{ data: sinceLastWeek }, { data: sinceThisWeek }] = await Promise.all([
      supabase.rpc('weekly_xp_by_grade', { p_grade: grade, p_week_start: lastWeekStartStr }),
      supabase.rpc('weekly_xp_by_grade', { p_grade: grade, p_week_start: thisWeekStartStr }),
    ])
    type XpRow = { user_id: string; xp: number }
    const xpSinceLastWeek = ((sinceLastWeek ?? []) as XpRow[]).find(u => u.user_id === userId)?.xp ?? 0
    const xpSinceThisWeek = ((sinceThisWeek ?? []) as XpRow[]).find(u => u.user_id === userId)?.xp ?? 0
    const userXp = Math.max(0, xpSinceLastWeek - xpSinceThisWeek)

    const botXps = BOT_ROSTER.map(bot => scaledBotXp(bot, lastWeekStart, lastWeekEnd, currentLeague))
    const rank = 1 + botXps.filter(xp => xp > userXp).length

    if (rank <= PROMOTION_CUTOFF && currentLeague < MAX_LEAGUE) {
      nextLeague = currentLeague + 1
      justPromoted = true
    }
  }

  await supabase
    .from('users')
    .update({ current_league: nextLeague, league_week_start: thisWeekStartStr })
    .eq('id', userId)

  return { league: nextLeague, justPromoted, previousLeague: justPromoted ? currentLeague : null }
}
