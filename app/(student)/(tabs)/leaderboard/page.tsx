export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAuthedUser } from '@/lib/data/student'
import { getWeeklyBoard } from '@/lib/leaderboard/board'
import { checkLeaguePromotion, leagueName, leagueEmoji, MAX_LEAGUE } from '@/lib/leaderboard/leagues'

export default async function LeaderboardPage() {
  const supabase = await createClient()
  const user = await getAuthedUser()
  const userId = user?.id ?? ''

  const { data: profile } = await supabase.from('users').select('grade').eq('id', userId).single()
  const grade = profile?.grade ?? 4

  const promotion = await checkLeaguePromotion(userId, grade)
  const board = await getWeeklyBoard(userId, grade, promotion.league)

  return (
    <div className="max-w-lg mx-auto px-4 py-8 page-enter">
      <div className="mb-6">
        <h1 className="text-3xl font-black mb-1 tracking-tight">Leaderboard 🏆</h1>
        <p className="text-gray-500 font-semibold">This week&apos;s top climbers — resets Monday.</p>
      </div>

      {promotion.justPromoted ? (
        <div
          className="rounded-3xl p-5 mb-6 text-center"
          style={{ background: 'linear-gradient(135deg, #fde68a, #fbbf24)' }}
        >
          <div style={{ fontSize: 40 }}>{leagueEmoji(promotion.league)}</div>
          <p className="font-black text-lg text-amber-900 mt-1">Promoted to {leagueName(promotion.league)} League!</p>
          <p className="text-amber-800 text-sm font-semibold mt-1">Top 3 last week — keep it up.</p>
        </div>
      ) : (
        <div className="rounded-2xl p-3 mb-6 flex items-center gap-2 justify-center bg-white border-2" style={{ borderColor: 'var(--border)' }}>
          <span style={{ fontSize: 22 }}>{leagueEmoji(promotion.league)}</span>
          <span className="font-black" style={{ color: 'var(--primary)' }}>{leagueName(promotion.league)} League</span>
          {promotion.league < MAX_LEAGUE && (
            <span className="text-xs font-bold text-gray-400">· top 3 this week to advance</span>
          )}
        </div>
      )}

      <div className="space-y-2">
        {board.map((entry, i) => (
          <div
            key={entry.id}
            className="rounded-2xl p-4 flex items-center gap-3 border-2"
            style={{
              background: entry.isSelf ? 'rgba(108,99,255,0.08)' : 'white',
              borderColor: entry.isSelf ? 'var(--primary)' : 'var(--border)',
            }}
          >
            <span className="font-black text-lg w-6 text-center shrink-0" style={{ color: i < 3 ? 'var(--xp)' : 'var(--muted)' }}>
              {i + 1}
            </span>
            <span style={{ fontSize: 28 }} className="shrink-0">{entry.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="font-black truncate">
                {entry.displayName}
                {entry.isSelf && <span style={{ color: 'var(--primary)' }}> (You)</span>}
              </div>
            </div>
            <span className="font-black shrink-0" style={{ color: 'var(--xp)' }}>{entry.xp} ⚡</span>
          </div>
        ))}
      </div>
    </div>
  )
}
