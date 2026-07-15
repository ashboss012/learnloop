/**
 * Session logic tests.
 *
 * Each test encodes one non-negotiable from AGENTS.md so a future
 * change cannot silently break the core promise.
 *
 * Re-queue and "progress only moves forward" are enforced client-side
 * (SessionRunner.tsx). Those behaviors are verified by reading the
 * component source; a component-level test suite is the correct next
 * step once a React testing setup exists.
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
  getQuestion,
  gradeAnswer,
  completeSession,
} from '@/app/actions/session'

// ── mock client factories ─────────────────────────────────────────────────────

const USER_ID = 'user-1'
const SESS_ID  = 'sess-1'
const SQ_ID    = 'sq-1'

function makeRpc() {
  return vi.fn().mockResolvedValue({ data: 1, error: null })
}

/**
 * Minimal Supabase client for getQuestion tests.
 * Captures the columns string passed to .select() so we can assert on it.
 */
function clientForGetQuestion(returnData: Record<string, unknown>) {
  const selectedCols: string[] = []
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockImplementation((cols: string) => {
        selectedCols.push(cols)
        return {
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: returnData, error: null }),
          }),
        }
      }),
    }),
    rpc: makeRpc(),
    _selectedCols: selectedCols,
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
 * Captures what is passed to session_questions.insert() so we can
 * assert on the number of questions generated.
 */
function clientForStartSession() {
  const insertedQuestions: unknown[] = []
  const rpc = makeRpc()

  const FAKE_SQ = Array.from({ length: 8 }, (_, i) => ({
    id: `q${i}`, prompt: 'Q', choices: [], difficulty: 1, position: i,
  }))

  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'skills') return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'sk1', slug: 'math-multiplication', subject: 'math', difficulty_order: 1 },
              error: null,
            }),
          }),
        }),
      }
      if (table === 'sessions') return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: SESS_ID }, error: null }),
          }),
        }),
      }
      if (table === 'session_questions') return {
        insert: vi.fn().mockImplementation((rows: unknown[]) => {
          insertedQuestions.push(...rows)
          return {
            select: vi.fn().mockResolvedValue({ data: FAKE_SQ, error: null }),
          }
        }),
      }
      return {}
    }),
    rpc,
    _insertedQuestions: insertedQuestions,
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

// ── getQuestion ───────────────────────────────────────────────────────────────

describe('getQuestion — answer leakage (non-negotiable #5)', () => {
  test('select columns never include "answer"', async () => {
    const client = clientForGetQuestion({
      id: SQ_ID, prompt: 'Q', choices: [], difficulty: 1, position: 0,
    })
    vi.mocked(createClient).mockResolvedValue(client as any)

    await getQuestion(SQ_ID)

    for (const cols of client._selectedCols) {
      expect(cols.toLowerCase()).not.toContain('answer')
    }
  })

  test('returned payload has no answer field', async () => {
    const client = clientForGetQuestion({
      id: SQ_ID, prompt: 'Q', choices: [], difficulty: 1, position: 0,
    })
    vi.mocked(createClient).mockResolvedValue(client as any)

    const result = await getQuestion(SQ_ID)

    // Serialize to catch answer leaking through any key
    const json = JSON.stringify(result)
    // "answer" as a key should not appear; "answer" appears in "correctAnswer" but
    // that field only exists in gradeAnswer responses, not getQuestion
    expect(result).not.toHaveProperty('question.answer')
    expect(json).not.toMatch(/"answer"\s*:/)
  })
})

// ── gradeAnswer ───────────────────────────────────────────────────────────────

describe('gradeAnswer — correct/incorrect paths', () => {
  test('returns correct: true when chosen matches answer (case-insensitive)', async () => {
    vi.mocked(createClient).mockResolvedValue(
      clientForGradeAnswer({ sqAnswer: 'Correct' }) as any
    )

    const result = await gradeAnswer(SESS_ID, SQ_ID, 'correct', 1)

    expect(result).not.toHaveProperty('error')
    expect((result as any).correct).toBe(true)
  })

  test('returns correct: false when chosen does not match', async () => {
    vi.mocked(createClient).mockResolvedValue(
      clientForGradeAnswer({ sqAnswer: 'correct', sqExplanation: 'Here is why.' }) as any
    )

    const result = await gradeAnswer(SESS_ID, SQ_ID, 'wrong-answer', 1)

    expect(result).not.toHaveProperty('error')
    expect((result as any).correct).toBe(false)
  })

  test('always returns a non-empty explanation on a wrong answer', async () => {
    vi.mocked(createClient).mockResolvedValue(
      clientForGradeAnswer({ sqAnswer: 'correct', sqExplanation: 'Here is why.' }) as any
    )

    const result = await gradeAnswer(SESS_ID, SQ_ID, 'wrong-answer', 1)

    expect((result as any).explanation).toBeTruthy()
    expect((result as any).explanation.trim().length).toBeGreaterThan(0)
  })

  test('always returns a non-empty explanation on a correct answer', async () => {
    vi.mocked(createClient).mockResolvedValue(
      clientForGradeAnswer({ sqAnswer: 'correct', sqExplanation: 'Here is why.' }) as any
    )

    const result = await gradeAnswer(SESS_ID, SQ_ID, 'correct', 1)

    expect((result as any).explanation).toBeTruthy()
    expect((result as any).explanation.trim().length).toBeGreaterThan(0)
  })
})

describe('gradeAnswer — XP never decreases (non-negotiable, wrong answer path)', () => {
  test('wrong answer: increment_xp is NOT called', async () => {
    const client = clientForGradeAnswer({ sqAnswer: 'correct' })
    vi.mocked(createClient).mockResolvedValue(client as any)

    await gradeAnswer(SESS_ID, SQ_ID, 'wrong', 1)

    const xpCalls = client._rpc.mock.calls.filter((c: unknown[]) => c[0] === 'increment_xp')
    expect(xpCalls.length).toBe(0)
  })

  test('first-attempt correct: increment_xp called with positive amount', async () => {
    const client = clientForGradeAnswer({ sqAnswer: 'correct' })
    vi.mocked(createClient).mockResolvedValue(client as any)

    await gradeAnswer(SESS_ID, SQ_ID, 'correct', 1)

    const xpCalls = client._rpc.mock.calls.filter((c: unknown[]) => c[0] === 'increment_xp')
    expect(xpCalls.length).toBe(1)
    expect((xpCalls[0][1] as { amount: number }).amount).toBeGreaterThan(0)
  })

  test('second-attempt correct: increment_xp is NOT called (+5 is first-attempt only)', async () => {
    const client = clientForGradeAnswer({ sqAnswer: 'correct' })
    vi.mocked(createClient).mockResolvedValue(client as any)

    await gradeAnswer(SESS_ID, SQ_ID, 'correct', 2)

    const xpCalls = client._rpc.mock.calls.filter((c: unknown[]) => c[0] === 'increment_xp')
    expect(xpCalls.length).toBe(0)
  })
})

// ── completeSession ───────────────────────────────────────────────────────────

describe('completeSession — XP and streak (non-negotiables)', () => {
  test('awards exactly +50 XP on completion', async () => {
    const client = clientForCompleteSession()
    vi.mocked(createClient).mockResolvedValue(client as any)

    await completeSession(SESS_ID)

    const xpCalls = client._rpc.mock.calls.filter((c: unknown[]) => c[0] === 'increment_xp')
    expect(xpCalls.length).toBe(1)
    expect((xpCalls[0][1] as { amount: number }).amount).toBe(50)
  })

  test('XP amount is always positive — never decreases', async () => {
    const client = clientForCompleteSession()
    vi.mocked(createClient).mockResolvedValue(client as any)

    await completeSession(SESS_ID)

    for (const call of client._rpc.mock.calls) {
      if (call[0] === 'increment_xp') {
        expect((call[1] as { amount: number }).amount).toBeGreaterThan(0)
      }
    }
  })

  test('calls update_streak exactly once per completion', async () => {
    const client = clientForCompleteSession()
    vi.mocked(createClient).mockResolvedValue(client as any)

    await completeSession(SESS_ID)

    const streakCalls = client._rpc.mock.calls.filter((c: unknown[]) => c[0] === 'update_streak')
    expect(streakCalls.length).toBe(1)
  })

  test('streak RPC receives the correct user id', async () => {
    const client = clientForCompleteSession()
    vi.mocked(createClient).mockResolvedValue(client as any)

    await completeSession(SESS_ID)

    const streakCall = client._rpc.mock.calls.find((c: unknown[]) => c[0] === 'update_streak')
    expect((streakCall![1] as { uid: string }).uid).toBe(USER_ID)
  })
})

// ── startSession ──────────────────────────────────────────────────────────────

describe('startSession — session length (non-negotiable #2)', () => {
  test('generates exactly 8 questions per session', async () => {
    const client = clientForStartSession()
    vi.mocked(createClient).mockResolvedValue(client as any)

    await startSession('skill-id-1')

    expect(client._insertedQuestions.length).toBe(8)
  })
})
