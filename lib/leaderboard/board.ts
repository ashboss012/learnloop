import { createClient } from '@/lib/supabase/server'
import { BOT_ROSTER, getWeekStart } from '@/lib/leaderboard/bots'
import { scaledBotXp } from '@/lib/leaderboard/leagues'

export interface BoardEntry {
  id: string
  displayName: string
  emoji: string
  xp: number
  isSelf: boolean
}

const BOARD_SIZE = 10

interface WeeklyXpRow {
  user_id: string
  display_name: string
  xp: number
}

export async function getWeeklyBoard(userId: string, grade: number, league: number = 1): Promise<BoardEntry[]> {
  const supabase = await createClient()
  const weekStart = getWeekStart()

  const { data: realUsers } = await supabase.rpc('weekly_xp_by_grade', {
    p_grade: grade,
    p_week_start: weekStart.toISOString().slice(0, 10),
  })

  const realEntries: BoardEntry[] = ((realUsers ?? []) as WeeklyXpRow[]).map(u => ({
    id: u.user_id,
    displayName: u.display_name,
    emoji: '🧑',
    xp: u.xp,
    isSelf: u.user_id === userId,
  }))

  const slotsForBots = Math.max(0, BOARD_SIZE - realEntries.length)
  const now = new Date()
  const botEntries: BoardEntry[] = BOT_ROSTER.slice(0, slotsForBots).map(bot => ({
    id: bot.id,
    displayName: bot.displayName,
    emoji: bot.emoji,
    xp: scaledBotXp(bot, weekStart, now, league),
    isSelf: false,
  }))

  return [...realEntries, ...botEntries].sort((a, b) => b.xp - a.xp)
}
