'use server'

import { createClient } from '@/lib/supabase/server'
import { generateQuestion } from '@/lib/math/generator'
import { startingTier, type Tier } from '@/lib/mastery'
import { revalidatePath } from 'next/cache'

const SESSION_LENGTH = 8
const XP_PER_SESSION = 50
const XP_FIRST_CORRECT = 5

export async function startSession(skillId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const [{ data: skill }, { data: profile }] = await Promise.all([
    supabase.from('skills').select('*').eq('id', skillId).single(),
    supabase.from('users').select('grade').eq('id', user.id).single(),
  ])
  if (!skill) return { error: 'Skill not found' }

  const { data: session, error: sessionErr } = await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      skill_id: skillId,
      subject: skill.subject,
      question_count: SESSION_LENGTH,
    })
    .select()
    .single()
  if (sessionErr) return { error: sessionErr.message }

  const tier = await resolveTier(supabase, user.id, skillId, skill.slug, profile?.grade ?? 4)

  const q = generateQuestion(skill.slug, tier)
  const { error: qErr } = await supabase.from('session_questions').insert({
    session_id: session.id,
    skill_id: skillId,
    prompt: q.prompt,
    choices: q.choices,
    answer: q.answer,
    explanation: q.explanation,
    difficulty: tier,
    position: 0,
  })
  if (qErr) return { error: qErr.message }

  return { sessionId: session.id }
}

// Reuses the persisted (user, skill) tier if one exists, otherwise seeds
// one from grade and persists it immediately so it's stable across sessions.
async function resolveTier(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  skillId: string,
  slug: string,
  grade: number,
): Promise<Tier> {
  const { data: progress } = await supabase
    .from('user_skill_progress')
    .select('tier')
    .eq('user_id', userId)
    .eq('skill_id', skillId)
    .maybeSingle()

  if (progress?.tier) return progress.tier as Tier

  const tier = startingTier(slug, grade)
  await supabase.from('user_skill_progress').upsert(
    { user_id: userId, skill_id: skillId, tier, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,skill_id' },
  )
  return tier
}

export async function getSessionForRunner(sessionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: session } = await supabase
    .from('sessions')
    .select('user_id, status, question_count, skills(name)')
    .eq('id', sessionId)
    .single()
  if (!session || session.user_id !== user.id) return { error: 'Forbidden' }
  if (session.status === 'completed') return { error: 'Already completed' }

  // Never select "answer" here - this crosses into the RSC payload sent
  // to the browser as a prop, not just a server-only fetch (non-negotiable #5).
  const { data: question, error } = await supabase
    .from('session_questions')
    .select('id, prompt, choices, difficulty, position')
    .eq('session_id', sessionId)
    .eq('position', 0)
    .single()
  if (error || !question) return { error: 'Question not found' }

  return {
    skillName: (session.skills as unknown as { name: string } | null)?.name ?? 'Math',
    questionCount: session.question_count,
    question,
  }
}

export async function getNextQuestion(sessionId: string, lastSessionQuestionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: session } = await supabase
    .from('sessions')
    .select('user_id, status, skill_id, question_count, skills(slug)')
    .eq('id', sessionId)
    .single()
  if (!session || session.user_id !== user.id) return { error: 'Forbidden' }
  if (session.status === 'completed') return { error: 'Session already completed' }
  const slug = (session.skills as unknown as { slug: string } | null)?.slug
  if (!slug) return { error: 'Skill not found' }

  const { data: lastQuestion } = await supabase
    .from('session_questions')
    .select('id, position')
    .eq('id', lastSessionQuestionId)
    .eq('session_id', sessionId)
    .single()
  if (!lastQuestion) return { error: 'Question not found' }

  const nextPosition = lastQuestion.position + 1
  if (nextPosition >= session.question_count) {
    return { error: 'Session already has all questions' }
  }

  // Idempotency: a duplicate call must not generate a second question or
  // step the tier twice for the same transition.
  const { data: existingNext } = await supabase
    .from('session_questions')
    .select('id, prompt, choices, difficulty, position')
    .eq('session_id', sessionId)
    .eq('position', nextPosition)
    .maybeSingle()
  if (existingNext) return { question: existingNext }

  // Tier steps off the primary pass's one and only attempt on the question
  // just finished - the missed-questions review never calls this.
  const { data: firstAttempt } = await supabase
    .from('session_answers')
    .select('was_correct')
    .eq('session_question_id', lastSessionQuestionId)
    .eq('attempt_number', 1)
    .single()
  const wasCorrectFirstTry = firstAttempt?.was_correct ?? false

  const { data: progress } = await supabase
    .from('user_skill_progress')
    .select('tier')
    .eq('user_id', user.id)
    .eq('skill_id', session.skill_id)
    .single()
  const currentTier = progress?.tier ?? 1
  const nextTier = wasCorrectFirstTry ? Math.min(3, currentTier + 1) : Math.max(1, currentTier - 1)

  await supabase.from('user_skill_progress').upsert(
    { user_id: user.id, skill_id: session.skill_id, tier: nextTier, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,skill_id' },
  )

  const q = generateQuestion(slug, nextTier)
  const { data: inserted, error: qErr } = await supabase
    .from('session_questions')
    .insert({
      session_id: sessionId,
      skill_id: session.skill_id,
      prompt: q.prompt,
      choices: q.choices,
      answer: q.answer,
      explanation: q.explanation,
      difficulty: nextTier,
      position: nextPosition,
    })
    .select('id, prompt, choices, difficulty, position')
    .single()
  if (qErr || !inserted) return { error: qErr?.message ?? 'Failed to generate question' }

  return { question: inserted }
}

export async function gradeAnswer(
  sessionId: string,
  sessionQuestionId: string,
  chosen: string,
  attemptNumber: number,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Fetch the full question including answer (server only)
  const { data: sq, error } = await supabase
    .from('session_questions')
    .select('answer, explanation, session_id')
    .eq('id', sessionQuestionId)
    .single()

  if (error || !sq) return { error: 'Question not found' }

  // Verify this question belongs to the user's session
  const { data: session } = await supabase
    .from('sessions')
    .select('user_id, status')
    .eq('id', sq.session_id)
    .single()

  if (!session || session.user_id !== user.id) return { error: 'Forbidden' }
  if (session.status === 'completed') return { error: 'Session already completed' }

  const correct = chosen.trim().toLowerCase() === sq.answer.trim().toLowerCase()

  await supabase.from('session_answers').insert({
    session_id: sessionId,
    session_question_id: sessionQuestionId,
    chosen,
    was_correct: correct,
    attempt_number: attemptNumber,
  })

  if (correct && attemptNumber === 1) {
    await supabase.rpc('increment_xp', { uid: user.id, amount: XP_FIRST_CORRECT })
  }

  return {
    correct,
    correctAnswer: sq.answer,
    explanation: sq.explanation,
  }
}

export async function completeSession(sessionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: session } = await supabase
    .from('sessions')
    .select('user_id, status')
    .eq('id', sessionId)
    .single()

  if (!session || session.user_id !== user.id) return { error: 'Forbidden' }
  if (session.status === 'completed') return { error: 'Already completed' }

  await supabase
    .from('sessions')
    .update({ status: 'completed', xp_earned: XP_PER_SESSION, completed_at: new Date().toISOString() })
    .eq('id', sessionId)

  await supabase.rpc('increment_xp', { uid: user.id, amount: XP_PER_SESSION })
  const { data: streakData } = await supabase.rpc('update_streak', { uid: user.id })

  revalidatePath('/dashboard')

  return { xpEarned: XP_PER_SESSION, streak: streakData }
}

export async function getSessionProgress(sessionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('session_answers')
    .select('session_question_id, was_correct, attempt_number')
    .eq('session_id', sessionId)
    .order('answered_at', { ascending: true })

  return data
}
