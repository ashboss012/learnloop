export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StartSessionButton from '@/components/StartSessionButton'

const SKILL_ICONS: Record<string, string> = {
  'math-multiplication': '✖️',
  'math-division': '➗',
  'math-fractions': '½',
  'math-decimals': '·',
}

const SKILL_COLORS: Record<string, string> = {
  'math-multiplication': '#6c63ff',
  'math-division': '#f59e0b',
  'math-fractions': '#22c55e',
  'math-decimals': '#ef4444',
}

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: skills }, { data: streak }] = await Promise.all([
    supabase.from('users').select('display_name, xp_total').eq('id', user.id).single(),
    supabase.from('skills').select('*').eq('subject', 'math').order('difficulty_order'),
    supabase.from('streaks').select('*').eq('user_id', user.id).single(),
  ])

  const displayName = profile?.display_name ?? 'Friend'
  const xp = profile?.xp_total ?? 0
  const currentStreak = streak?.current_streak ?? 0
  const freezes = streak?.freezes_available ?? 2

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b-2 px-4 py-3 flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <span className="text-2xl font-black" style={{ color: 'var(--primary)' }}>🧠 LearnLoop</span>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 font-bold text-sm" style={{ color: 'var(--xp)' }}>
            <span>⚡</span><span>{xp} XP</span>
          </div>
          <div className="flex items-center gap-1 font-bold text-sm" style={{ color: '#f97316' }}>
            <span>🔥</span><span>{currentStreak}</span>
          </div>
          {freezes > 0 && (
            <div className="flex items-center gap-1 font-bold text-sm text-blue-400">
              <span>🧊</span><span>{freezes}</span>
            </div>
          )}
          <form action="/api/auth/signout" method="POST">
            <button className="text-xs text-gray-400 font-semibold hover:text-gray-600">Sign out</button>
          </form>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-3xl font-black mb-1">Hey, {displayName}! 👋</h1>
          <p className="text-gray-500 font-semibold">What do you want to practice today?</p>
        </div>

        {/* Streak banner */}
        {currentStreak > 0 && (
          <div className="rounded-3xl p-4 mb-6 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #fed7aa, #fef3c7)' }}>
            <span className="text-3xl">🔥</span>
            <div>
              <p className="font-black text-orange-700">{currentStreak}-day streak!</p>
              <p className="text-orange-600 text-sm font-semibold">Keep it up — come back tomorrow!</p>
            </div>
          </div>
        )}

        {/* Skills grid */}
        <h2 className="text-xl font-black mb-4">Math Skills</h2>
        <div className="grid grid-cols-2 gap-4">
          {skills?.map(skill => (
            <StartSessionButton key={skill.id} skill={skill} color={SKILL_COLORS[skill.slug] ?? '#6c63ff'} icon={SKILL_ICONS[skill.slug] ?? '📐'} />
          ))}
        </div>
      </main>
    </div>
  )
}
