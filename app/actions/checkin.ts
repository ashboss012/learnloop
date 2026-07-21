'use server'

import { createClient } from '@/lib/supabase/server'

const CHECKIN_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000

export interface SkillActivity {
  skillId: string
  name: string
  slug: string
  questionsAnswered: number
  accuracy: number | null
  tier: number
}

type NotDue = { due: false }
type Due = {
  due: true
  sessionsCompleted: number
  questionsAnswered: number
  overallAccuracy: number | null
  skills: SkillActivity[]
}

type AnswerRow = { was_correct: boolean; session_questions: { skill_id: string } | { skill_id: string }[] | null }

export async function getCheckinData(): Promise<NotDue | Due> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { due: false }

  const { data: profile } = await supabase.from('users').select('last_checkin_at').eq('id', user.id).single()
  const lastCheckin = profile?.last_checkin_at ? new Date(profile.last_checkin_at) : null
  const now = new Date()
  if (lastCheckin && now.getTime() - lastCheckin.getTime() < CHECKIN_INTERVAL_MS) {
    return { due: false }
  }

  const windowStart = new Date(now.getTime() - CHECKIN_INTERVAL_MS).toISOString()

  const [{ data: sessions }, { data: answers }, { data: progress }, { data: skills }] = await Promise.all([
    supabase.from('sessions').select('status, completed_at').eq('user_id', user.id).eq('kind', 'practice').gte('completed_at', windowStart),
    supabase.from('session_answers').select('was_correct, session_questions(skill_id)').eq('attempt_number', 1).gte('answered_at', windowStart),
    supabase.from('user_skill_progress').select('skill_id, tier').eq('user_id', user.id),
    supabase.from('skills').select('id, name, slug'),
  ])

  const sessionsCompleted = (sessions ?? []).filter(s => s.status === 'completed').length

  const bySkill = new Map<string, { correct: number; total: number }>()
  let totalCorrect = 0
  let totalCount = 0
  for (const row of (answers ?? []) as AnswerRow[]) {
    totalCount++
    if (row.was_correct) totalCorrect++
    const sq = row.session_questions
    const skillId = Array.isArray(sq) ? sq[0]?.skill_id : sq?.skill_id
    if (!skillId) continue
    const entry = bySkill.get(skillId) ?? { correct: 0, total: 0 }
    entry.total++
    if (row.was_correct) entry.correct++
    bySkill.set(skillId, entry)
  }

  const tierBySkill = new Map((progress ?? []).map(p => [p.skill_id, p.tier]))
  const skillsById = new Map((skills ?? []).map(s => [s.id, s]))

  const skillActivity: SkillActivity[] = Array.from(bySkill.entries())
    .map(([skillId, stats]) => {
      const skill = skillsById.get(skillId)
      return {
        skillId,
        name: skill?.name ?? 'Unknown',
        slug: skill?.slug ?? '',
        questionsAnswered: stats.total,
        accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : null,
        tier: tierBySkill.get(skillId) ?? 1,
      }
    })
    .sort((a, b) => b.questionsAnswered - a.questionsAnswered)

  return {
    due: true,
    sessionsCompleted,
    questionsAnswered: totalCount,
    overallAccuracy: totalCount > 0 ? Math.round((totalCorrect / totalCount) * 100) : null,
    skills: skillActivity,
  }
}

export async function dismissCheckin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  await supabase.from('users').update({ last_checkin_at: new Date().toISOString() }).eq('id', user.id)
  return { success: true }
}
