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
  getSkipCheckpoint,
  resolveSkipCheckpoint,
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
 * `firstAttempts` models the session_answers rows at attempt_number=1;
 * `questionCount` and `currentTier` drive the perfect-run/level-up path.
 */
function clientForCompleteSession({
  firstAttempts = [true, true, true, true, true, true, true, true] as boolean[],
  questionCount = 8,
  currentTier = 1,
} = {}) {
  const rpc = makeRpc()
  let upsertedRow: { tier: number; due_for_review_at?: string; last_practiced_at?: string } | null = null
  const progressUpsert = vi.fn().mockImplementation((row: typeof upsertedRow) => {
    upsertedRow = row
    return Promise.resolve({ data: null, error: null })
  })

  const tables: Record<string, unknown> = {
    sessions: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { user_id: USER_ID, status: 'active', skill_id: 'sk1', question_count: questionCount },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    },
    session_answers: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: firstAttempts.map(was_correct => ({ was_correct })),
            error: null,
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
    rpc,
    _rpc: rpc,
    _getUpsertedTier: () => upsertedRow?.tier ?? null,
    _getUpsertedRow: () => upsertedRow,
    _progressUpsert: progressUpsert,
  }
  return client
}

function daysFromNowUTC(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
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

describe('completeSession — perfect-run skip-ahead reward', () => {
  test('all first attempts correct, below Lv 3: reports perfect + leveledUp, upserts tier 3', async () => {
    const client = clientForCompleteSession({
      firstAttempts: [true, true, true, true, true, true, true, true],
      questionCount: 8,
      currentTier: 2,
    })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await completeSession(SESS_ID)

    expect((result as Record<string, unknown>).perfect).toBe(true)
    expect((result as Record<string, unknown>).leveledUp).toBe(true)
    expect(client._getUpsertedTier()).toBe(3)
  })

  test('already at Lv 3: perfect but not leveledUp, tier unchanged in the (still-fired) upsert', async () => {
    const client = clientForCompleteSession({
      firstAttempts: [true, true, true, true, true, true, true, true],
      questionCount: 8,
      currentTier: 3,
    })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await completeSession(SESS_ID)

    expect((result as Record<string, unknown>).perfect).toBe(true)
    expect((result as Record<string, unknown>).leveledUp).toBe(false)
    // Upsert still fires (it also carries the spaced-review date), just
    // without bumping a tier that's already at the cap.
    expect(client._getUpsertedTier()).toBe(3)
  })

  test('one wrong first attempt: not perfect, tier unchanged, normal XP unaffected', async () => {
    const client = clientForCompleteSession({
      firstAttempts: [true, true, false, true, true, true, true, true],
      questionCount: 8,
      currentTier: 1,
    })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await completeSession(SESS_ID)

    expect((result as Record<string, unknown>).perfect).toBe(false)
    expect((result as Record<string, unknown>).leveledUp).toBe(false)
    expect(client._getUpsertedTier()).toBe(1)

    const xpCalls = client._rpc.mock.calls.filter((c: unknown[]) => c[0] === 'increment_xp')
    expect(xpCalls.length).toBe(1)
    expect((xpCalls[0][1] as { amount: number }).amount).toBe(50)
  })

  test('fewer first attempts than question_count (session exited early): never perfect', async () => {
    const client = clientForCompleteSession({
      firstAttempts: [true, true, true],
      questionCount: 8,
      currentTier: 1,
    })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await completeSession(SESS_ID)

    expect((result as Record<string, unknown>).perfect).toBe(false)
    expect(client._getUpsertedTier()).toBe(1)
  })

  test('a failed skip-checkpoint attempt (position >= question_count) does not break the perfect badge', async () => {
    // 8 required questions, all correct, plus one wrong checkpoint answer
    // from a declined/failed skip attempt earlier in the session.
    const rpc = makeRpc()
    let upsertedTier: number | null = null
    const progressUpsert = vi.fn().mockImplementation((row: { tier: number }) => {
      upsertedTier = row.tier
      return Promise.resolve({ data: null, error: null })
    })
    const answers = [
      ...Array.from({ length: 8 }, (_, i) => ({ was_correct: true, session_questions: { position: i } })),
      { was_correct: false, session_questions: { position: 8 } },
    ]
    const tables: Record<string, unknown> = {
      sessions: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { user_id: USER_ID, status: 'active', skill_id: 'sk1', question_count: 8 },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
      },
      session_answers: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: answers, error: null }),
          }),
        }),
      },
      user_skill_progress: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { tier: 2 }, error: null }),
            }),
          }),
        }),
        upsert: progressUpsert,
      },
    }
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => tables[table] ?? {}),
      rpc,
    }
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await completeSession(SESS_ID)

    expect((result as Record<string, unknown>).perfect).toBe(true)
    expect((result as Record<string, unknown>).leveledUp).toBe(true)
    expect(upsertedTier).toBe(3)
  })
})

describe('completeSession — spaced review (docs/08 signal 2)', () => {
  test('a session with a miss comes due for review tomorrow', async () => {
    const client = clientForCompleteSession({
      firstAttempts: [true, true, false, true, true, true, true, true],
      questionCount: 8,
      currentTier: 2,
    })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    await completeSession(SESS_ID)

    const row = client._getUpsertedRow()
    expect(row?.due_for_review_at).toBe(daysFromNowUTC(1))
    expect(row?.last_practiced_at).toBeTruthy()
  })

  test('a perfect session is pushed further out (4 days)', async () => {
    const client = clientForCompleteSession({
      firstAttempts: [true, true, true, true, true, true, true, true],
      questionCount: 8,
      currentTier: 2,
    })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    await completeSession(SESS_ID)

    const row = client._getUpsertedRow()
    expect(row?.due_for_review_at).toBe(daysFromNowUTC(4))
  })
})

// ── getSkipCheckpoint / resolveSkipCheckpoint ───────────────────────────────────

function clientForGetSkipCheckpoint({
  questionCount = 8,
  skillSlug = 'math-multiplication',
  existingCheckpoint = null as Record<string, unknown>[] | null,
  sessionStatus = 'active' as 'active' | 'completed',
} = {}) {
  const insertedRows: Record<string, unknown>[] = []
  const tables: Record<string, unknown> = {
    sessions: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              user_id: USER_ID, status: sessionStatus, skill_id: 'sk1',
              question_count: questionCount, skills: { slug: skillSlug },
            },
            error: null,
          }),
        }),
      }),
    },
    session_questions: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: existingCheckpoint ?? [], error: null }),
          }),
        }),
      }),
      insert: vi.fn().mockImplementation((rows: Record<string, unknown>[]) => {
        insertedRows.push(...rows)
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: rows.map((r, i) => ({ id: `cp-${i}`, ...r })), error: null }),
          }),
        }
      }),
    },
  }
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    from: vi.fn().mockImplementation((table: string) => tables[table] ?? {}),
    _insertedRows: insertedRows,
  }
}

describe('getSkipCheckpoint', () => {
  test('generates 2 tier-3 questions positioned right after question_count', async () => {
    const client = clientForGetSkipCheckpoint({ questionCount: 8 })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await getSkipCheckpoint(SESS_ID)

    expect(client._insertedRows.length).toBe(2)
    expect(client._insertedRows.every(r => r.difficulty === 3)).toBe(true)
    expect(client._insertedRows.map(r => r.position)).toEqual([8, 9])
    expect((result as { questions: unknown[] }).questions.length).toBe(2)
  })

  test('idempotent: returns the existing checkpoint instead of regenerating', async () => {
    const existing = [
      { id: 'cp-0', prompt: 'Q', choices: [], difficulty: 3, position: 8 },
      { id: 'cp-1', prompt: 'Q', choices: [], difficulty: 3, position: 9 },
    ]
    const client = clientForGetSkipCheckpoint({ questionCount: 8, existingCheckpoint: existing })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await getSkipCheckpoint(SESS_ID)

    expect((result as { questions: unknown[] }).questions).toEqual(existing)
    expect(client._insertedRows.length).toBe(0)
  })

  test('refuses when the session is already completed', async () => {
    const client = clientForGetSkipCheckpoint({ sessionStatus: 'completed' })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await getSkipCheckpoint(SESS_ID)

    expect((result as Record<string, unknown>).error).toBeTruthy()
    expect(client._insertedRows.length).toBe(0)
  })
})

function clientForResolveSkipCheckpoint({
  checkpointCorrect = [true, true] as boolean[],
  questionCount = 8,
  sessionStatus = 'active' as 'active' | 'completed',
  incomplete = false,
} = {}) {
  const rpc = makeRpc()
  let upsertedRow: { tier: number; due_for_review_at?: string; last_practiced_at?: string } | null = null
  const progressUpsert = vi.fn().mockImplementation((row: typeof upsertedRow) => {
    upsertedRow = row
    return Promise.resolve({ data: null, error: null })
  })
  const sessionUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) })

  const answers = checkpointCorrect.map((was_correct, i) => ({
    was_correct,
    session_questions: { position: questionCount + i },
  }))
  const rows = incomplete ? answers.slice(0, 1) : answers

  const tables: Record<string, unknown> = {
    sessions: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { user_id: USER_ID, status: sessionStatus, skill_id: 'sk1', question_count: questionCount },
            error: null,
          }),
        }),
      }),
      update: sessionUpdate,
    },
    session_answers: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
        }),
      }),
    },
    user_skill_progress: { upsert: progressUpsert },
  }
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    from: vi.fn().mockImplementation((table: string) => tables[table] ?? {}),
    rpc,
    _rpc: rpc,
    _getUpsertedTier: () => upsertedRow?.tier ?? null,
    _getUpsertedRow: () => upsertedRow,
    _progressUpsert: progressUpsert,
    _sessionUpdate: sessionUpdate,
  }
}

describe('resolveSkipCheckpoint', () => {
  test('both checkpoint questions correct: passes, jumps to tier 3, awards full session XP', async () => {
    const client = clientForResolveSkipCheckpoint({ checkpointCorrect: [true, true] })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await resolveSkipCheckpoint(SESS_ID)

    expect((result as Record<string, unknown>).passed).toBe(true)
    expect(client._getUpsertedTier()).toBe(3)
    expect(client._sessionUpdate).toHaveBeenCalled()
    expect(client._getUpsertedRow()?.due_for_review_at).toBe(daysFromNowUTC(4))
    const xpCalls = client._rpc.mock.calls.filter((c: unknown[]) => c[0] === 'increment_xp')
    expect(xpCalls.length).toBe(1)
    expect((xpCalls[0][1] as { amount: number }).amount).toBe(50)
  })

  test('one checkpoint question wrong: fails, no tier upsert, session left untouched', async () => {
    const client = clientForResolveSkipCheckpoint({ checkpointCorrect: [true, false] })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await resolveSkipCheckpoint(SESS_ID)

    expect((result as Record<string, unknown>).passed).toBe(false)
    expect(client._progressUpsert).not.toHaveBeenCalled()
    expect(client._sessionUpdate).not.toHaveBeenCalled()
    const xpCalls = client._rpc.mock.calls.filter((c: unknown[]) => c[0] === 'increment_xp')
    expect(xpCalls.length).toBe(0)
  })

  test('checkpoint not finished yet: returns an error, no side effects', async () => {
    const client = clientForResolveSkipCheckpoint({ incomplete: true })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await resolveSkipCheckpoint(SESS_ID)

    expect((result as Record<string, unknown>).error).toBeTruthy()
    expect(client._progressUpsert).not.toHaveBeenCalled()
    expect(client._sessionUpdate).not.toHaveBeenCalled()
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
