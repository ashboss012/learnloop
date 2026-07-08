'use server'

import { createClient } from '@/lib/supabase/server'
import { generateQuestion } from '@/lib/math/generator'
import { revalidatePath } from 'next/cache'

const SESSION_LENGTH = 8
const XP_PER_SESSION = 50
const XP_FIRST_CORRECT = 5

export async function startSession(skillId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: skill } = await supabase
    .from('skills')
    .select('*')
    .eq('id', skillId)
    .single()
  if (!skill) return { error: 'Skill not found' }

  // Create the session
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

  // Generate questions server-side (answer stored in DB, never sent to client)
  const tier = Math.ceil((skill.difficulty_order || 1) / 1.5)
  const questions = []
  for (let i = 0; i < SESSION_LENGTH; i++) {
    const q = generateQuestion(skill.slug, Math.min(tier, 3))
    questions.push({
      session_id: session.id,
      skill_id: skillId,
      prompt: q.prompt,
      choices: q.choices,
      answer: q.answer,
      explanation: q.explanation,
      difficulty: tier,
      position: i,
    })
  }

  const { data: inserted, error: qErr } = await supabase
    .from('session_questions')
    .insert(questions)
    .select('id, prompt, choices, difficulty, position')

  if (qErr) return { error: qErr.message }

  const orderedIds = inserted
    .sort((a, b) => a.position - b.position)
    .map(q => q.id)

  return { sessionId: session.id, questionIds: orderedIds }
}

export async function getQuestion(sessionQuestionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // RLS ensures this is the user's own session; we select everything EXCEPT answer
  const { data, error } = await supabase
    .from('session_questions')
    .select('id, prompt, choices, difficulty, position')
    .eq('id', sessionQuestionId)
    .single()

  if (error) return { error: error.message }
  return { question: data }
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
