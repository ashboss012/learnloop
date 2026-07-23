'use server'

import { createClient } from '@/lib/supabase/server'
import { generateQuestion } from '@/lib/questionGenerator'
import { MAX_TIER } from '@/lib/mastery'
import { revalidatePath } from 'next/cache'

// Round 1 always runs at a fixed medium tier - the point is reading his
// natural level once per skill. Math gets a round 2 (see getDiagnosticRound2)
// whose tier depends on round 1's result; English stays single-round. This
// is deliberately coarse (placements land on {1,3,5}, not every tier) - the
// normal ±1 per-question stepping refines it during real practice.
const DIAGNOSTIC_ROUND1_TIER = 3

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

  // Reading comprehension has no adaptive tier and pulls from the reviewed
  // content pool, not the tiered generator - it can't be placed the way
  // every other skill can, so it's excluded from the diagnostic entirely.
  const { data: skills } = await supabase
    .from('skills')
    .select('id, slug')
    .eq('subject', subject)
    .neq('slug', 'english-reading-comprehension')
    .order('difficulty_order')
  if (!skills || skills.length === 0) return { error: 'No skills found for this subject' }

  const rounds = subject === 'math' ? 2 : 1

  // Anchored to the first skill purely to satisfy the FK - session_questions
  // below span every skill in the subject, not just this one.
  const { data: session, error: sessionErr } = await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      skill_id: skills[0].id,
      subject,
      kind: 'diagnostic',
      question_count: skills.length * rounds,
    })
    .select()
    .single()
  if (sessionErr) return { error: sessionErr.message }

  // Only round 1 is generated now - round 2 (math only) depends on round
  // 1's live results and is fetched on demand (getDiagnosticRound2).
  const rows = skills.map((skill, i) => {
    const q = generateQuestion(skill.slug, DIAGNOSTIC_ROUND1_TIER)
    return {
      session_id: session.id,
      skill_id: skill.id,
      prompt: q.prompt,
      choices: q.choices,
      answer: q.answer,
      explanation: q.explanation,
      difficulty: DIAGNOSTIC_ROUND1_TIER,
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
    .select('user_id, status, subject, kind, question_count')
    .eq('id', sessionId)
    .single()
  if (!session || session.user_id !== user.id) return { error: 'Forbidden' }
  if (session.kind !== 'diagnostic') return { error: 'Not a diagnostic session' }
  if (session.status === 'completed') return { error: 'Already completed' }

  // Only whatever's been generated so far (round 1 alone on a fresh math
  // diagnostic) - unlike a practice session, a whole generated batch is
  // safe to hand to the client at once since tier is fixed per round.
  // Never selects "answer" (non-negotiable #5).
  const { data: questions, error } = await supabase
    .from('session_questions')
    .select('id, prompt, choices, difficulty, position')
    .eq('session_id', sessionId)
    .order('position')
  if (error || !questions || questions.length === 0) return { error: 'Questions not found' }

  return { subject: session.subject as string, questionCount: session.question_count, questions }
}

export async function getDiagnosticRound2(sessionId: string) {
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
  if (session.subject !== 'math') return { error: 'Round 2 only applies to math' }
  if (session.status === 'completed') return { error: 'Already completed' }

  const { data: mathSkills } = await supabase
    .from('skills')
    .select('id, slug')
    .eq('subject', 'math')
    .order('difficulty_order')
  if (!mathSkills || mathSkills.length === 0) return { error: 'No skills found' }
  const round1Count = mathSkills.length

  // Idempotency: if round 2 already exists, just return it.
  const { data: existing } = await supabase
    .from('session_questions')
    .select('id, prompt, choices, difficulty, position')
    .eq('session_id', sessionId)
    .gte('position', round1Count)
    .order('position')
  if (existing && existing.length > 0) return { questions: existing }

  const { data: round1Answers } = await supabase
    .from('session_answers')
    .select('was_correct, session_questions(skill_id)')
    .eq('session_id', sessionId)
    .eq('attempt_number', 1)

  type AnswerRow = { was_correct: boolean; session_questions: { skill_id: string } | { skill_id: string }[] | null }
  const correctBySkill = new Map<string, boolean>()
  for (const row of (round1Answers ?? []) as AnswerRow[]) {
    const sq = row.session_questions
    const skillId = Array.isArray(sq) ? sq[0]?.skill_id : sq?.skill_id
    if (skillId) correctBySkill.set(skillId, row.was_correct)
  }

  const rows = mathSkills.map((skill, i) => {
    const wasCorrect = correctBySkill.get(skill.id) ?? false
    const tier = wasCorrect ? MAX_TIER : 1
    const q = generateQuestion(skill.slug, tier)
    return {
      session_id: sessionId,
      skill_id: skill.id,
      prompt: q.prompt,
      choices: q.choices,
      answer: q.answer,
      explanation: q.explanation,
      difficulty: tier,
      position: round1Count + i,
    }
  })

  const { data: inserted, error: qErr } = await supabase
    .from('session_questions')
    .insert(rows)
    .select('id, prompt, choices, difficulty, position')
    .order('position')
  if (qErr || !inserted) return { error: qErr?.message ?? 'Failed to generate round 2' }

  return { questions: inserted }
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
    .select('was_correct, session_questions(skill_id, position)')
    .eq('session_id', sessionId)
    .eq('attempt_number', 1)

  type AnswerRow = {
    was_correct: boolean
    session_questions: { skill_id: string; position: number } | { skill_id: string; position: number }[] | null
  }

  // Group by skill - English has 1 row per skill (binary), math has 2
  // (round 1 + round 2), combined into a placement on {1, 3, 5} - coarse
  // by design, the normal ±1 per-question stepping refines it from there.
  const bySkill = new Map<string, { position: number; correct: boolean }[]>()
  for (const row of (answers ?? []) as AnswerRow[]) {
    const sq = row.session_questions
    const entry = Array.isArray(sq) ? sq[0] : sq
    if (!entry) continue
    const list = bySkill.get(entry.skill_id) ?? []
    list.push({ position: entry.position, correct: row.was_correct })
    bySkill.set(entry.skill_id, list)
  }

  const now = new Date().toISOString()
  for (const [skillId, results] of bySkill) {
    results.sort((a, b) => a.position - b.position)
    let tier: number
    if (results.length === 1) {
      tier = results[0].correct ? MAX_TIER : 1
    } else {
      const [r1, r2] = results
      if (r1.correct && r2.correct) tier = MAX_TIER
      else if (r1.correct && !r2.correct) tier = 3
      else if (!r1.correct && r2.correct) tier = 3
      else tier = 1
    }
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
