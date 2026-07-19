/**
 * Session logic tests.
 *
 * Each test encodes one non-negotiable from AGENTS.md so a future
 * change cannot silently break the core promise.
 *
 * The "8 questions per session" invariant (non-negotiable #2) is now
 * enforced across two places instead of one bulk insert: startSession
 * creates only question 0, and getNextQuestion refuses to generate a
 * question at position >= question_count. Both are covered below.
 *
 * The missed-questions review round (re-asking a wrong answer at the
 * end of the session instead of immediately) is client-side state in
 * SessionRunner.tsx and reuses gradeAnswer's existing attempt_number
 * tracking untouched — no new server logic to test there.
 */

import { vi, describe, test, expect, beforeEach } from 'vitest'

// ── module mocks (hoisted before imports of the module under test) ────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/math/generator', () => ({
  generateQuestion: vi.fn().mockReturnValue({
    prompt: 'What is 3 × 4?',
    choices: [{ label: '12', value: '12' }],
    answer: '12',
    explanation: '3 × 4 = 12.',
    type: 'multiple_choice',
  }),
}))

vi.mock('@/lib/supabase/server')

// Import AFTER mocks are declared
import { createClient } from '@/lib/supabase/server'
import {
  startSession,
  getSessionForRunner,
  getNextQuestion,
  gradeAnswer,
  completeSession,
} from '@/app/actions/session'

// Mock clients below are structurally shaped, not full SupabaseClient
// instances - cast through this alias instead of `any`.
type MockClient = Awaited<ReturnType<typeof createClient>>

// ── mock client factories ─────────────────────────────────────────────────────

const USER_ID = 'user-1'
const SESS_ID  = 'sess-1'
const SQ_ID    = 'sq-1'

function makeRpc() {
  return vi.fn().mockResolvedValue({ data: 1, error: null })
}

/**
 * Client for getSessionForRunner tests.
 * Captures the columns string passed to session_questions.select() so we
 * can assert on it.
 */
function clientForGetSessionForRunner({
  sessionUserId = USER_ID,
  status = 'active' as 'active' | 'completed',
  questionData = { id: SQ_ID, prompt: 'Q', choices: [], difficulty: 1, position: 0 } as Record<string, unknown>,
} = {}) {
  const selectedCols: string[] = []
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'sessions') return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { user_id: sessionUserId, status, question_count: 8, skills: { name: 'Multiplication' } },
              error: null,
            }),
          }),
        }),
      }
      if (table === 'session_questions') return {
        select: vi.fn().mockImplementation((cols: string) => {
          selectedCols.push(cols)
          return {
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: questionData, error: null }),
              }),
            }),
          }
        }),
      }
      return {}
    }),
    _selectedCols: selectedCols,
  }
  return client
}

/**
 * Client for getNextQuestion tests.
 * All table handlers are built once (not per from() call) so upsert/insert
 * spies are stable across the multiple from() invocations inside one call.
 */
function clientForGetNextQuestion({
  wasCorrectFirstTry = true,
  currentTier = 1,
  existingNextQuestion = null as Record<string, unknown> | null,
  lastPosition = 0,
  questionCount = 8,
  skillSlug = 'math-multiplication',
} = {}) {
  const insertedQuestions: unknown[] = []
  let upsertedTier: number | null = null

  const progressUpsert = vi.fn().mockImplementation((row: { tier: number }) => {
    upsertedTier = row.tier
    return Promise.resolve({ data: null, error: null })
  })

  const tables: Record<string, unknown> = {
    sessions: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              user_id: USER_ID, status: 'active', skill_id: 'sk1',
              question_count: questionCount, skills: { slug: skillSlug },
            },
            error: null,
          }),
        }),
      }),
    },
    session_questions: {
      select: vi.fn().mockImplementation((cols: string) => {
        if (cols === 'id, position') {
          return {
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: SQ_ID, position: lastPosition }, error: null }),
              }),
            }),
          }
        }
        return {
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: existingNextQuestion, error: null }),
            }),
          }),
        }
      }),
      insert: vi.fn().mockImplementation((row: unknown) => {
        insertedQuestions.push(row)
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'new-q', ...(row as object) }, error: null }),
          }),
        }
      }),
    },
    session_answers: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { was_correct: wasCorrectFirstTry }, error: null }),
          }),
        }),
      }),
    },
    user_skill_progress: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { tier: currentTier }, error: null }),
          }),
        }),
      }),
      upsert: progressUpsert,
    },
  }

  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    from: vi.fn().mockImplementation((table: string) => tables[table] ?? {}),
    _insertedQuestions: insertedQuestions,
    _getUpsertedTier: () => upsertedTier,
    _progressUpsert: progressUpsert,
  }
  return client
}

/**
 * Client for gradeAnswer tests.
 * Routes from() by table name so each call gets the right data.
 */
function clientForGradeAnswer({
  sqAnswer = 'correct',
  sqExplanation = 'Because.',
  sessionUserId = USER_ID,
  sessionStatus = 'active' as 'active' | 'completed',
} = {}) {
  const rpc = makeRpc()
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'session_questions') return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { answer: sqAnswer, explanation: sqExplanation, session_id: SESS_ID },
              error: null,
            }),
          }),
        }),
      }
      if (table === 'sessions') return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { user_id: sessionUserId, status: sessionStatus },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }
      if (table === 'session_answers') return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
      return {}
    }),
    rpc,
    _rpc: rpc,
  }
  return client
}

/**
 * Client for startSession tests.
 * All table handlers are built once so the user_skill_progress spies are
 * stable across from() calls within a single startSession() run.
 */
function clientForStartSession({
  existingTier = null as number | null,
  grade = 4,
  skillSlug = 'math-multiplication',
} = {}) {
  const insertedQuestions: unknown[] = []
  let upsertedProgress: { tier: number } | null = null

  const progressUpsert = vi.fn().mockImplementation((row: { tier: number }) => {
    upsertedProgress = row
    return Promise.resolve({ data: null, error: null })
  })

  const tables: Record<string, unknown> = {
    skills: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'sk1', slug: skillSlug, subject: 'math', difficulty_order: 1 },
            error: null,
          }),
        }),
      }),
    },
    users: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { grade }, error: null }),
        }),
      }),
    },
    sessions: {
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: SESS_ID }, error: null }),
        }),
      }),
    },
    user_skill_progress: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: existingTier != null ? { tier: existingTier } : null,
              error: null,
            }),
          }),
        }),
      }),
      upsert: progressUpsert,
    },
    session_questions: {
      insert: vi.fn().mockImplementation((row: unknown) => {
        insertedQuestions.push(row)
        return Promise.resolve({ data: null, error: null })
      }),
    },
  }

  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    from: vi.fn().mockImplementation((table: string) => tables[table] ?? {}),
    _insertedQuestions: insertedQuestions,
    _getUpsertedProgress: () => upsertedProgress,
    _progressUpsert: progressUpsert,
  }
  return client
}

/**
 * Client for completeSession tests.
 */
function clientForCompleteSession() {
  const rpc = makeRpc()
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'sessions') return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { user_id: USER_ID, status: 'active' },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }
      return {}
    }),
    rpc,
    _rpc: rpc,
  }
  return client
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── getSessionForRunner ────────────────────────────────────────────────────────

describe('getSessionForRunner — answer leakage (non-negotiable #5)', () => {
  test('select columns never include "answer"', async () => {
    const client = clientForGetSessionForRunner()
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    await getSessionForRunner(SESS_ID)

    for (const cols of client._selectedCols) {
      expect(cols.toLowerCase()).not.toContain('answer')
    }
  })

  test('returned payload has no answer field', async () => {
    const client = clientForGetSessionForRunner()
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await getSessionForRunner(SESS_ID)

    const json = JSON.stringify(result)
    expect(json).not.toMatch(/"answer"\s*:/)
  })

  test('forbidden when session belongs to a different user', async () => {
    const client = clientForGetSessionForRunner({ sessionUserId: 'someone-else' })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await getSessionForRunner(SESS_ID)

    expect((result as Record<string, unknown>).error).toBe('Forbidden')
  })
})

// ── getNextQuestion ───────────────────────────────────────────────────────────

describe('getNextQuestion — adaptive tier stepping', () => {
  test('steps tier +1 on first-attempt-correct', async () => {
    const client = clientForGetNextQuestion({ wasCorrectFirstTry: true, currentTier: 1 })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    await getNextQuestion(SESS_ID, SQ_ID)

    expect(client._getUpsertedTier()).toBe(2)
    expect((client._insertedQuestions[0] as Record<string, unknown>).difficulty).toBe(2)
  })

  test('tier is capped at 3', async () => {
    const client = clientForGetNextQuestion({ wasCorrectFirstTry: true, currentTier: 3 })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    await getNextQuestion(SESS_ID, SQ_ID)

    expect(client._getUpsertedTier()).toBe(3)
  })

  test('steps tier -1 on first-attempt-incorrect', async () => {
    const client = clientForGetNextQuestion({ wasCorrectFirstTry: false, currentTier: 2 })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    await getNextQuestion(SESS_ID, SQ_ID)

    expect(client._getUpsertedTier()).toBe(1)
  })

  test('tier is floored at 1', async () => {
    const client = clientForGetNextQuestion({ wasCorrectFirstTry: false, currentTier: 1 })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    await getNextQuestion(SESS_ID, SQ_ID)

    expect(client._getUpsertedTier()).toBe(1)
  })

  test('idempotent: an existing question at the next position is returned, not regenerated', async () => {
    const existing = { id: 'existing-q', prompt: 'Q', choices: [], difficulty: 2, position: 1 }
    const client = clientForGetNextQuestion({ existingNextQuestion: existing, lastPosition: 0 })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await getNextQuestion(SESS_ID, SQ_ID)

    expect((result as Record<string, unknown>).question).toEqual(existing)
    expect(client._insertedQuestions.length).toBe(0)
    expect(client._progressUpsert).not.toHaveBeenCalled()
  })

  test('refuses to generate past the session question count', async () => {
    const client = clientForGetNextQuestion({ lastPosition: 7, questionCount: 8 })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await getNextQuestion(SESS_ID, SQ_ID)

    expect((result as Record<string, unknown>).error).toBeTruthy()
    expect(client._insertedQuestions.length).toBe(0)
  })
})

// ── gradeAnswer ───────────────────────────────────────────────────────────────

describe('gradeAnswer — correct/incorrect paths', () => {
  test('returns correct: true when chosen matches answer (case-insensitive)', async () => {
    vi.mocked(createClient).mockResolvedValue(
      clientForGradeAnswer({ sqAnswer: 'Correct' }) as unknown as MockClient
    )

    const result = await gradeAnswer(SESS_ID, SQ_ID, 'correct', 1)

    expect(result).not.toHaveProperty('error')
    expect((result as Record<string, unknown>).correct).toBe(true)
  })

  test('returns correct: false when chosen does not match', async () => {
    vi.mocked(createClient).mockResolvedValue(
      clientForGradeAnswer({ sqAnswer: 'correct', sqExplanation: 'Here is why.' }) as unknown as MockClient
    )

    const result = await gradeAnswer(SESS_ID, SQ_ID, 'wrong-answer', 1)

    expect(result).not.toHaveProperty('error')
    expect((result as Record<string, unknown>).correct).toBe(false)
  })

  test('always returns a non-empty explanation on a wrong answer', async () => {
    vi.mocked(createClient).mockResolvedValue(
      clientForGradeAnswer({ sqAnswer: 'correct', sqExplanation: 'Here is why.' }) as unknown as MockClient
    )

    const result = await gradeAnswer(SESS_ID, SQ_ID, 'wrong-answer', 1)

    expect((result as Record<string, unknown>).explanation).toBeTruthy()
    expect((result as Record<string, unknown>).explanation.trim().length).toBeGreaterThan(0)
  })

  test('always returns a non-empty explanation on a correct answer', async () => {
    vi.mocked(createClient).mockResolvedValue(
      clientForGradeAnswer({ sqAnswer: 'correct', sqExplanation: 'Here is why.' }) as unknown as MockClient
    )

    const result = await gradeAnswer(SESS_ID, SQ_ID, 'correct', 1)

    expect((result as Record<string, unknown>).explanation).toBeTruthy()
    expect((result as Record<string, unknown>).explanation.trim().length).toBeGreaterThan(0)
  })
})

describe('gradeAnswer — XP never decreases (non-negotiable, wrong answer path)', () => {
  test('wrong answer: increment_xp is NOT called', async () => {
    const client = clientForGradeAnswer({ sqAnswer: 'correct' })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    await gradeAnswer(SESS_ID, SQ_ID, 'wrong', 1)

    const xpCalls = client._rpc.mock.calls.filter((c: unknown[]) => c[0] === 'increment_xp')
    expect(xpCalls.length).toBe(0)
  })

  test('first-attempt correct: increment_xp called with positive amount', async () => {
    const client = clientForGradeAnswer({ sqAnswer: 'correct' })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    await gradeAnswer(SESS_ID, SQ_ID, 'correct', 1)

    const xpCalls = client._rpc.mock.calls.filter((c: unknown[]) => c[0] === 'increment_xp')
    expect(xpCalls.length).toBe(1)
    expect((xpCalls[0][1] as { amount: number }).amount).toBeGreaterThan(0)
  })

  test('later-attempt correct (e.g. during the missed-questions review): increment_xp is NOT called (+5 is first-attempt only)', async () => {
    const client = clientForGradeAnswer({ sqAnswer: 'correct' })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    await gradeAnswer(SESS_ID, SQ_ID, 'correct', 2)

    const xpCalls = client._rpc.mock.calls.filter((c: unknown[]) => c[0] === 'increment_xp')
    expect(xpCalls.length).toBe(0)
  })
})

// ── completeSession ───────────────────────────────────────────────────────────

describe('completeSession — XP and streak (non-negotiables)', () => {
  test('awards exactly +50 XP on completion', async () => {
    const client = clientForCompleteSession()
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    await completeSession(SESS_ID)

    const xpCalls = client._rpc.mock.calls.filter((c: unknown[]) => c[0] === 'increment_xp')
    expect(xpCalls.length).toBe(1)
    expect((xpCalls[0][1] as { amount: number }).amount).toBe(50)
  })

  test('XP amount is always positive — never decreases', async () => {
    const client = clientForCompleteSession()
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    await completeSession(SESS_ID)

    for (const call of client._rpc.mock.calls) {
      if (call[0] === 'increment_xp') {
        expect((call[1] as { amount: number }).amount).toBeGreaterThan(0)
      }
    }
  })

  test('calls update_streak exactly once per completion', async () => {
    const client = clientForCompleteSession()
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    await completeSession(SESS_ID)

    const streakCalls = client._rpc.mock.calls.filter((c: unknown[]) => c[0] === 'update_streak')
    expect(streakCalls.length).toBe(1)
  })

  test('streak RPC receives the correct user id', async () => {
    const client = clientForCompleteSession()
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    await completeSession(SESS_ID)

    const streakCall = client._rpc.mock.calls.find((c: unknown[]) => c[0] === 'update_streak')
    expect((streakCall![1] as { uid: string }).uid).toBe(USER_ID)
  })
})

// ── startSession ──────────────────────────────────────────────────────────────

describe('startSession — session length (non-negotiable #2)', () => {
  test('generates exactly 1 question, at position 0', async () => {
    const client = clientForStartSession()
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    await startSession('skill-id-1')

    expect(client._insertedQuestions.length).toBe(1)
    expect((client._insertedQuestions[0] as Record<string, unknown>).position).toBe(0)
  })
})

describe('startSession — tier resolution', () => {
  test('seeds a tier from grade and persists it when no prior progress exists', async () => {
    // grade 5 for math-multiplication -> startingTier() = 3 (see lib/mastery.ts)
    const client = clientForStartSession({ existingTier: null, grade: 5, skillSlug: 'math-multiplication' })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    await startSession('skill-id-1')

    expect(client._getUpsertedProgress()?.tier).toBe(3)
    expect((client._insertedQuestions[0] as Record<string, unknown>).difficulty).toBe(3)
  })

  test('reuses an existing progress row instead of reseeding', async () => {
    const client = clientForStartSession({ existingTier: 2, grade: 5 })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    await startSession('skill-id-1')

    expect((client._insertedQuestions[0] as Record<string, unknown>).difficulty).toBe(2)
    expect(client._progressUpsert).not.toHaveBeenCalled()
  })
})
