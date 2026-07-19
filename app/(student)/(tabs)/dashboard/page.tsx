export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAuthedUser, getHeaderData } from '@/lib/data/student'
import StartSessionButton from '@/components/StartSessionButton'
import Mascot from '@/components/Mascot'
import { startingTier } from '@/lib/mastery'
import { SKILL_ICONS, SKILL_COLORS } from '@/lib/skillDisplay'

export default async function Dashboard() {
  const supabase = await createClient()
  const user = await getAuthedUser()
  const userId = user?.id ?? ''

  const [{ currentStreak }, { data: profile }, { data: skills }, { data: progress }] = await Promise.all([
    getHeaderData(userId),
    supabase.from('users').select('display_name, grade').eq('id', userId).single(),
    supabase.from('skills').select('*').eq('subject', 'math').order('difficulty_order'),
    supabase.from('user_skill_progress').select('skill_id, tier').eq('user_id', userId),
  ])

  const displayName = profile?.display_name ?? 'Friend'
  const grade = profile?.grade ?? 4
  const tierBySkill = new Map((progress ?? []).map(p => [p.skill_id, p.tier]))

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* Greeting */}
      <div className="mb-6 flex items-center gap-3">
        <Mascot mood={currentStreak > 0 ? 'excited' : 'happy'} size={56} />
        <div>
          <h1 className="text-3xl font-black mb-1 tracking-tight">Hey, {displayName}! 👋</h1>
          <p className="text-gray-500 font-semibold">What do you want to practice today?</p>
        </div>
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
      <div className="mb-4">
        <span className="block w-8 h-1 rounded-full mb-2" style={{ background: 'var(--primary)' }} />
        <h2 className="text-xl font-black">Math Skills</h2>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {skills?.map(skill => (
          <StartSessionButton
            key={skill.id}
            skill={skill}
            color={SKILL_COLORS[skill.slug] ?? '#6c63ff'}
            icon={SKILL_ICONS[skill.slug] ?? '📐'}
            tier={tierBySkill.get(skill.id) ?? startingTier(skill.slug, grade)}
          />
        ))}
      </div>
    </div>
  )
}
