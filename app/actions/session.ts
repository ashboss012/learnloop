'use server'

import { createClient } from '@/lib/supabase/server'
import { generateQuestion } from '@/lib/questionGenerator'
import { startingTier, type Tier } from '@/lib/mastery'
import { revalidatePath } from 'next/cache'

const SESSION_LENGTH = 8
const XP_PER_SESSION = 50
const XP_FIRST_CORRECT = 5
const READING_COMPREHENSION_SLUG = 'english-reading-comprehension'

// Skip-ahead checkpoint: the client (SessionRunner) decides when to offer
// it (after enough correct answers in a row); these just generate/resolve
// the 2 tier-3 gate questions once offered.
const CHECKPOINT_SIZE = 2
const CHECKPOINT_TIER = 3

export async function startSession(skillId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const [{ data: skill }, { data: profile }] = await Promise.all([
    supabase.from('skills').select('*').eq('id', skillId).single(),
    supabase.from('users').select('grade').eq('id', user.id).single(),
  ])
  if (!skill) return { error: 'Skill not found' }

  if (skill.slug === READING_COMPREHENSION_SLUG) {
    return startReadingSession(supabase, user.id, skill)
  }

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

// Reading comprehension pulls from the published content pool instead of
// procedurally generating - there's no adaptive tier for this skill, and
// question_count is however many questions the claimed passage has (see
// startDiagnostic for the same flexible-question_count precedent).
async function startReadingSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  skill: { id: string; subject: string },
) {
  const NO_CONTENT_ERROR = { error: 'No reading passages available yet - check back soon!' }

  // Neither RPC is in the (ungenerated) Supabase client types here, same
  // as every other .rpc() call in this file - cast the shape explicitly.
  const { data: claimedRaw } = await supabase
    .rpc('claim_reading_passage', { p_user_id: userId, p_skill_id: skill.id })
    .maybeSingle()
  const claimed = claimedRaw as { passage_id: string; passage_text: string } | null
  if (!claimed) return NO_CONTENT_ERROR

  const { data: questionsRaw } = await supabase.rpc('get_reading_questions', { p_passage_id: claimed.passage_id })
  const questions = questionsRaw as { prompt: string; choices: unknown; answer: string; explanation: string }[] | null
  if (!questions || questions.length === 0) return NO_CONTENT_ERROR

  const { data: session, error: sessionErr } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      skill_id: skill.id,
      subject: skill.subject,
      question_count: questions.length,
    })
    .select()
    .single()
  if (sessionErr) return { error: sessionErr.message }

  const rows = questions.map((q, i) => ({
    session_id: session.id,
    skill_id: skill.id,
    passage_id: claimed.passage_id,
    passage_text: claimed.passage_text,
    prompt: q.prompt,
    choices: q.choices,
    answer: q.answer,
    explanation: q.explanation,
    difficulty: 1,
    position: i,
  }))
  const { error: qErr } = await supabase.from('session_questions').insert(rows)
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
    .select('id, prompt, choices, difficulty, position, passage_text')
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
  // step the tier twice for the same transition. Also the only branch
  // reading-comprehension sessions ever take - startReadingSession
  // pre-inserts every position, so this always finds a row and the
  // tier-stepping/generation code below never runs for that skill.
  const { data: existingNext } = await supabase
    .from('session_questions')
    .select('id, prompt, choices, difficulty, position, passage_text')
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
    .select('id, prompt, choices, difficulty, position, passage_text')
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
    .select('user_id, status, skill_id, question_count')
    .eq('id', sessionId)
    .single()

  if (!session || session.user_id !== user.id) return { error: 'Forbidden' }
  if (session.status === 'completed') return { error: 'Already completed' }

  // Perfect run reward: every REQUIRED question (position < question_count -
  // excludes any skip-checkpoint attempt, which lives past that range)
  // answered correctly on the first attempt jumps straight to Lv 3 instead
  // of the normal one-step-at-a-time climb. Computed server-side off real
  // data, same as every other grading decision here - never trusted from
  // the client.
  const { data: firstAttempts } = await supabase
    .from('session_answers')
    .select('was_correct, session_questions(position)')
    .eq('session_id', sessionId)
    .eq('attempt_number', 1)

  type AnswerRow = { was_correct: boolean; session_questions: { position: number } | { position: number }[] | null }
  const attempts = ((firstAttempts ?? []) as AnswerRow[]).filter(a => {
    const sq = a.session_questions
    const position = Array.isArray(sq) ? sq[0]?.position : sq?.position
    return (position ?? -1) < session.question_count
  })
  const perfect = attempts.length === session.question_count && attempts.every(a => a.was_correct)

  let leveledUp = false
  if (perfect) {
    const { data: progress } = await supabase
      .from('user_skill_progress')
      .select('tier')
      .eq('user_id', user.id)
      .eq('skill_id', session.skill_id)
      .single()
    if ((progress?.tier ?? 1) < 3) {
      await supabase.from('user_skill_progress').upsert(
        { user_id: user.id, skill_id: session.skill_id, tier: 3, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,skill_id' },
      )
      leveledUp = true
    }
  }

  await supabase
    .from('sessions')
    .update({ status: 'completed', xp_earned: XP_PER_SESSION, completed_at: new Date().toISOString() })
    .eq('id', sessionId)

  await supabase.rpc('increment_xp', { uid: user.id, amount: XP_PER_SESSION })
  const { data: streakData } = await supabase.rpc('update_streak', { uid: user.id })

  revalidatePath('/dashboard')

  return { xpEarned: XP_PER_SESSION, streak: streakData, perfect, leveledUp }
}

// Skip-ahead checkpoint: offered mid-session to a student who's clearly
// acing it. Two tier-3 questions, generated past the session's normal
// question_count so they never collide with primary-pass positions.
// Passing both finishes the session early with full credit; failing
// either leaves the session untouched so the client can resume normally.
export async function getSkipCheckpoint(sessionId: string) {
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
  // Reading comprehension has no adaptive tier to skip ahead to, and its
  // 4-question length already can't satisfy the client's offer threshold -
  // this guard just makes that explicit rather than relying on it.
  if (slug === READING_COMPREHENSION_SLUG) return { error: 'Not available for this skill' }

  // Idempotency: a duplicate call must not generate a second checkpoint.
  const { data: existing } = await supabase
    .from('session_questions')
    .select('id, prompt, choices, difficulty, position')
    .eq('session_id', sessionId)
    .gte('position', session.question_count)
    .order('position', { ascending: true })
  if (existing && existing.length > 0) return { questions: existing }

  const rows = Array.from({ length: CHECKPOINT_SIZE }, (_, i) => {
    const q = generateQuestion(slug, CHECKPOINT_TIER)
    return {
      session_id: sessionId,
      skill_id: session.skill_id,
      prompt: q.prompt,
      choices: q.choices,
      answer: q.answer,
      explanation: q.explanation,
      difficulty: CHECKPOINT_TIER,
      position: session.question_count + i,
    }
  })

  const { data: inserted, error } = await supabase
    .from('session_questions')
    .insert(rows)
    .select('id, prompt, choices, difficulty, position')
    .order('position', { ascending: true })
  if (error || !inserted) return { error: error?.message ?? 'Failed to generate checkpoint' }

  return { questions: inserted }
}

export async function resolveSkipCheckpoint(sessionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: session } = await supabase
    .from('sessions')
    .select('user_id, status, skill_id, question_count')
    .eq('id', sessionId)
    .single()
  if (!session || session.user_id !== user.id) return { error: 'Forbidden' }
  if (session.status === 'completed') return { error: 'Already completed' }

  const { data: answers } = await supabase
    .from('session_answers')
    .select('was_correct, session_questions(position)')
    .eq('session_id', sessionId)
    .eq('attempt_number', 1)

  type AnswerRow = { was_correct: boolean; session_questions: { position: number } | { position: number }[] | null }
  const checkpointAnswers = ((answers ?? []) as AnswerRow[]).filter(a => {
    const sq = a.session_questions
    const position = Array.isArray(sq) ? sq[0]?.position : sq?.position
    return (position ?? -1) >= session.question_count
  })
  if (checkpointAnswers.length < CHECKPOINT_SIZE) return { error: 'Checkpoint not finished yet' }

  const passed = checkpointAnswers.every(a => a.was_correct)
  if (!passed) return { passed: false as const }

  await supabase.from('user_skill_progress').upsert(
    { user_id: user.id, skill_id: session.skill_id, tier: 3, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,skill_id' },
  )

  await supabase
    .from('sessions')
    .update({ status: 'completed', xp_earned: XP_PER_SESSION, completed_at: new Date().toISOString() })
    .eq('id', sessionId)

  await supabase.rpc('increment_xp', { uid: user.id, amount: XP_PER_SESSION })
  const { data: streakData } = await supabase.rpc('update_streak', { uid: user.id })

  revalidatePath('/dashboard')

  return { passed: true as const, xpEarned: XP_PER_SESSION, streak: streakData }
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
