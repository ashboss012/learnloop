export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAuthedUser } from '@/lib/data/student'
import { startingTier } from '@/lib/mastery'
import { SKILL_ICONS, SKILL_COLORS } from '@/lib/skillDisplay'

type FirstAttemptRow = {
  was_correct: boolean
  session_questions: { skill_id: string } | { skill_id: string }[] | null
}

function skillIdOf(row: FirstAttemptRow): string | null {
  const sq = row.session_questions
  if (!sq) return null
  return Array.isArray(sq) ? sq[0]?.skill_id ?? null : sq.skill_id
}

export default async function StatsPage() {
  const supabase = await createClient()
  const user = await getAuthedUser()
  const userId = user?.id ?? ''

  const [
    { data: profile },
    { data: streak },
    { data: skills },
    { data: progress },
    { data: sessions },
    { data: firstAttempts },
  ] = await Promise.all([
    supabase.from('users').select('grade').eq('id', userId).single(),
    supabase.from('streaks').select('current_streak, longest_streak').eq('user_id', userId).single(),
    supabase.from('skills').select('id, name, slug').order('subject').order('difficulty_order'),
    supabase.from('user_skill_progress').select('skill_id, tier').eq('user_id', userId),
    supabase.from('sessions').select('status, completed_at').eq('user_id', userId),
    supabase.from('session_answers').select('was_correct, session_questions(skill_id)').eq('attempt_number', 1),
  ])

  const grade = profile?.grade ?? 4
  const tierBySkill = new Map((progress ?? []).map(p => [p.skill_id, p.tier]))
  const sessionsCompleted = (sessions ?? []).filter(s => s.status === 'completed').length

  const bySkill = new Map<string, { correct: number; total: number }>()
  let totalCorrect = 0
  let totalCount = 0
  for (const row of (firstAttempts ?? []) as FirstAttemptRow[]) {
    totalCount++
    if (row.was_correct) totalCorrect++
    const skillId = skillIdOf(row)
    if (!skillId) continue
    const entry = bySkill.get(skillId) ?? { correct: 0, total: 0 }
    entry.total++
    if (row.was_correct) entry.correct++
    bySkill.set(skillId, entry)
  }
  const overallAccuracy = totalCount > 0 ? Math.round((totalCorrect / totalCount) * 100) : null

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - (6 - i))
    return d.toISOString().slice(0, 10)
  })
  const activeDates = new Set(
    (sessions ?? [])
      .filter(s => s.status === 'completed' && s.completed_at)
      .map(s => (s.completed_at as string).slice(0, 10))
  )

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-black mb-1 tracking-tight">Your Stats 📊</h1>
        <p className="text-gray-500 font-semibold">Just your own progress — no comparisons.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard label="Questions Answered" value={totalCount} icon="📝" />
        <StatCard label="Accuracy" value={overallAccuracy !== null ? `${overallAccuracy}%` : '—'} icon="🎯" />
        <StatCard label="Sessions Done" value={sessionsCompleted} icon="✅" />
        <StatCard label="Streak (cur/best)" value={`${streak?.current_streak ?? 0} / ${streak?.longest_streak ?? 0}`} icon="🔥" />
      </div>

      <div className="rounded-3xl p-5 mb-6 bg-white border-2" style={{ borderColor: 'var(--border)' }}>
        <h2 className="font-black mb-3">Last 7 Days</h2>
        <div className="flex justify-between">
          {last7.map(date => {
            const active = activeDates.has(date)
            const label = new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'narrow' })
            return (
              <div key={date} className="flex flex-col items-center gap-1">
                <div className="rounded-full" style={{ width: 28, height: 28, background: active ? 'var(--correct)' : '#e5e7eb' }} />
                <span className="text-xs font-bold text-gray-400">{label}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mb-4">
        <span className="block w-8 h-1 rounded-full mb-2" style={{ background: 'var(--primary)' }} />
        <h2 className="text-xl font-black">By Skill</h2>
      </div>
      <div className="space-y-3">
        {skills?.map(skill => {
          const s = bySkill.get(skill.id)
          const acc = s && s.total > 0 ? Math.round((s.correct / s.total) * 100) : null
          const tier = tierBySkill.get(skill.id) ?? startingTier(skill.slug, grade)
          const color = SKILL_COLORS[skill.slug] ?? '#6c63ff'
          return (
            <div key={skill.id} className="rounded-2xl p-4 flex items-center gap-3 bg-white border-2" style={{ borderColor: 'var(--border)' }}>
              <span style={{ fontSize: 28 }}>{SKILL_ICONS[skill.slug] ?? '📐'}</span>
              <div className="flex-1 min-w-0">
                <div className="font-black" style={{ color }}>{skill.name}</div>
                <div className="text-sm font-semibold text-gray-500">
                  {acc !== null ? `${acc}% accuracy · ${s!.total} answered` : 'Not started yet'}
                </div>
              </div>
              <span
                className="text-xs font-black rounded-full px-2 py-0.5 shrink-0"
                style={{ background: 'white', color, border: `1.5px solid ${color}40` }}
              >
                Lv {tier}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="rounded-2xl p-4 bg-white border-2" style={{ borderColor: 'var(--border)' }}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="font-black text-2xl">{value}</div>
      <div className="text-xs font-bold text-gray-400">{label}</div>
    </div>
  )
}
