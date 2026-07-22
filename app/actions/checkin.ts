'use server'

import { createClient } from '@/lib/supabase/server'

export interface SessionRecap {
  due: true
  skillName: string
  slug: string
  questionsAnswered: number
  correctCount: number
  accuracy: number | null
  xpEarned: number
}
type NotDue = { due: false }

type AnswerRow = { was_correct: boolean; session_questions: { position: number } | { position: number }[] | null }

// A "check-in" is a recap of the single most recently completed practice
// session, shown once. last_checkin_at doubles as "last dismissed at" -
// due whenever a completed session exists more recent than that timestamp
// (or last_checkin_at is null, i.e. never dismissed).
export async function getCheckinData(): Promise<NotDue | SessionRecap> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { due: false }

  const { data: profile } = await supabase.from('users').select('last_checkin_at').eq('id', user.id).single()
  const lastCheckin = profile?.last_checkin_at ? new Date(profile.last_checkin_at) : null

  const { data: session } = await supabase
    .from('sessions')
    .select('id, xp_earned, question_count, completed_at, skills(name, slug)')
    .eq('user_id', user.id)
    .eq('kind', 'practice')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!session || !session.completed_at) return { due: false }
  if (lastCheckin && new Date(session.completed_at).getTime() <= lastCheckin.getTime()) return { due: false }

  const { data: answers } = await supabase
    .from('session_answers')
    .select('was_correct, session_questions(position)')
    .eq('session_id', session.id)
    .eq('attempt_number', 1)

  // Scope to the session's required questions - excludes any skip-ahead
  // checkpoint attempt, which lives past question_count.
  const required = ((answers ?? []) as AnswerRow[]).filter(a => {
    const sq = a.session_questions
    const position = Array.isArray(sq) ? sq[0]?.position : sq?.position
    return (position ?? -1) < session.question_count
  })
  const correctCount = required.filter(a => a.was_correct).length
  const questionsAnswered = required.length

  const skill = session.skills as unknown as { name: string; slug: string } | { name: string; slug: string }[] | null
  const skillInfo = Array.isArray(skill) ? skill[0] : skill

  return {
    due: true,
    skillName: skillInfo?.name ?? 'Unknown',
    slug: skillInfo?.slug ?? '',
    questionsAnswered,
    correctCount,
    accuracy: questionsAnswered > 0 ? Math.round((correctCount / questionsAnswered) * 100) : null,
    xpEarned: session.xp_earned ?? 0,
  }
}

export async function dismissCheckin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  await supabase.from('users').update({ last_checkin_at: new Date().toISOString() }).eq('id', user.id)
  return { success: true }
}
