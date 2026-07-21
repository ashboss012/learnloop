'use server'

import { createClient } from '@/lib/supabase/server'
import { generateQuestion } from '@/lib/questionGenerator'
import { revalidatePath } from 'next/cache'

// Placement questions run at a fixed medium tier - the point is reading
// his natural level once, not adapting mid-diagnostic.
const DIAGNOSTIC_TIER = 2

type DiagnosticColumn = 'math_diagnostic_done' | 'english_diagnostic_done'

function diagnosticColumnFor(subject: string): DiagnosticColumn | null {
  if (subject === 'math') return 'math_diagnostic_done'
  if (subject === 'english') return 'english_diagnostic_done'
  return null
}

export async function startDiagnostic(subject: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const column = diagnosticColumnFor(subject)
  if (!column) return { error: 'Unknown subject' }

  const { data: profile } = await supabase.from('users').select(column).eq('id', user.id).single()
  if (profile && (profile as Record<string, boolean>)[column]) {
    return { error: 'Diagnostic already completed for this subject' }
  }

  const { data: skills } = await supabase
    .from('skills')
    .select('id, slug')
    .eq('subject', subject)
    .order('difficulty_order')
  if (!skills || skills.length === 0) return { error: 'No skills found for this subject' }

  // Anchored to the first skill purely to satisfy the FK - session_questions
  // below span every skill in the subject, not just this one.
  const { data: session, error: sessionErr } = await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      skill_id: skills[0].id,
      subject,
      kind: 'diagnostic',
      question_count: skills.length,
    })
    .select()
    .single()
  if (sessionErr) return { error: sessionErr.message }

  const rows = skills.map((skill, i) => {
    const q = generateQuestion(skill.slug, DIAGNOSTIC_TIER)
    return {
      session_id: session.id,
      skill_id: skill.id,
      prompt: q.prompt,
      choices: q.choices,
      answer: q.answer,
      explanation: q.explanation,
      difficulty: DIAGNOSTIC_TIER,
      position: i,
    }
  })

  const { error: qErr } = await supabase.from('session_questions').insert(rows)
  if (qErr) return { error: qErr.message }

  return { sessionId: session.id }
}

export async function getDiagnosticForRunner(sessionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: session } = await supabase
    .from('sessions')
    .select('user_id, status, subject, kind')
    .eq('id', sessionId)
    .single()
  if (!session || session.user_id !== user.id) return { error: 'Forbidden' }
  if (session.kind !== 'diagnostic') return { error: 'Not a diagnostic session' }
  if (session.status === 'completed') return { error: 'Already completed' }

  // Every question was generated upfront in startDiagnostic (fixed tier,
  // no adaptivity mid-diagnostic), so - unlike a practice session - the
  // whole ordered set is safe to hand to the client at once. Never
  // selects "answer" (non-negotiable #5).
  const { data: questions, error } = await supabase
    .from('session_questions')
    .select('id, prompt, choices, difficulty, position')
    .eq('session_id', sessionId)
    .order('position')
  if (error || !questions || questions.length === 0) return { error: 'Questions not found' }

  return { subject: session.subject as string, questions }
}

export async function completeDiagnostic(sessionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: session } = await supabase
    .from('sessions')
    .select('user_id, status, subject, kind')
    .eq('id', sessionId)
    .single()
  if (!session || session.user_id !== user.id) return { error: 'Forbidden' }
  if (session.kind !== 'diagnostic') return { error: 'Not a diagnostic session' }
  if (session.status === 'completed') return { error: 'Already completed' }

  const column = diagnosticColumnFor(session.subject)
  if (!column) return { error: 'Unknown subject' }

  const { data: answers } = await supabase
    .from('session_answers')
    .select('was_correct, session_questions(skill_id)')
    .eq('session_id', sessionId)
    .eq('attempt_number', 1)

  const now = new Date().toISOString()
  type AnswerRow = { was_correct: boolean; session_questions: { skill_id: string } | { skill_id: string }[] | null }
  for (const row of (answers ?? []) as AnswerRow[]) {
    const sq = row.session_questions
    const skillId = Array.isArray(sq) ? sq[0]?.skill_id : sq?.skill_id
    if (!skillId) continue
    const tier = row.was_correct ? 3 : 1
    await supabase.from('user_skill_progress').upsert(
      { user_id: user.id, skill_id: skillId, tier, updated_at: now },
      { onConflict: 'user_id,skill_id' },
    )
  }

  // No completion XP/streak RPCs here - a diagnostic is one-time setup,
  // not a day's practice signal. Per-question +5 XP on a correct first
  // attempt still applies via the normal gradeAnswer path (unchanged),
  // which works out as a small welcome bonus for free.
  await supabase.from('sessions').update({ status: 'completed', completed_at: now }).eq('id', sessionId)
  await supabase.from('users').update({ [column]: true }).eq('id', user.id)

  revalidatePath('/dashboard')

  return { success: true }
}
