/**
 * Check-in logic tests.
 *
 * The check-in card recaps the single most recently completed practice
 * session (not a rolling time window). last_checkin_at doubles as "last
 * dismissed at" - due whenever a completed session is more recent than
 * that timestamp, or the student has never dismissed one.
 */

import { vi, describe, test, expect, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server')

import { createClient } from '@/lib/supabase/server'
import { getCheckinData, dismissCheckin } from '@/app/actions/checkin'

type MockClient = Awaited<ReturnType<typeof createClient>>

const USER_ID = 'user-1'

function clientForCheckin({
  lastCheckinAt = null as string | null,
  session = null as Record<string, unknown> | null,
  answers = [] as { was_correct: boolean; position: number }[],
} = {}) {
  const usersUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) })

  const tables: Record<string, unknown> = {
    users: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { last_checkin_at: lastCheckinAt }, error: null }),
        }),
      }),
      update: usersUpdate,
    },
    sessions: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: session, error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    },
    session_answers: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: answers.map(a => ({ was_correct: a.was_correct, session_questions: { position: a.position } })),
            error: null,
          }),
        }),
      }),
    },
  }

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    from: vi.fn().mockImplementation((table: string) => tables[table] ?? {}),
    _usersUpdate: usersUpdate,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getCheckinData', () => {
  test('no completed practice session ever: not due', async () => {
    const client = clientForCheckin({ session: null })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await getCheckinData()

    expect(result.due).toBe(false)
  })

  test('never dismissed (last_checkin_at null) with a completed session: due, with correct recap', async () => {
    const client = clientForCheckin({
      lastCheckinAt: null,
      session: {
        id: 'sess-1', xp_earned: 50, question_count: 8, completed_at: '2026-07-20T10:00:00Z',
        skills: { name: 'Division', slug: 'math-division' },
      },
      answers: [
        { was_correct: true, position: 0 }, { was_correct: true, position: 1 },
        { was_correct: false, position: 2 }, { was_correct: true, position: 3 },
        { was_correct: true, position: 4 }, { was_correct: true, position: 5 },
        { was_correct: true, position: 6 }, { was_correct: true, position: 7 },
      ],
    })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await getCheckinData()

    expect(result.due).toBe(true)
    if (!result.due) throw new Error('unreachable')
    expect(result.skillName).toBe('Division')
    expect(result.slug).toBe('math-division')
    expect(result.questionsAnswered).toBe(8)
    expect(result.correctCount).toBe(7)
    expect(result.accuracy).toBe(88)
    expect(result.xpEarned).toBe(50)
  })

  test('last_checkin_at after the session completed_at: not due (already shown)', async () => {
    const client = clientForCheckin({
      lastCheckinAt: '2026-07-20T12:00:00Z',
      session: {
        id: 'sess-1', xp_earned: 50, question_count: 8, completed_at: '2026-07-20T10:00:00Z',
        skills: { name: 'Division', slug: 'math-division' },
      },
    })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await getCheckinData()

    expect(result.due).toBe(false)
  })

  test('last_checkin_at before the session completed_at: due (a new session happened since)', async () => {
    const client = clientForCheckin({
      lastCheckinAt: '2026-07-20T08:00:00Z',
      session: {
        id: 'sess-1', xp_earned: 50, question_count: 8, completed_at: '2026-07-20T10:00:00Z',
        skills: { name: 'Division', slug: 'math-division' },
      },
      answers: Array.from({ length: 8 }, (_, i) => ({ was_correct: true, position: i })),
    })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await getCheckinData()

    expect(result.due).toBe(true)
  })

  test('excludes skip-checkpoint attempts (position >= question_count) from the accuracy count', async () => {
    const client = clientForCheckin({
      lastCheckinAt: null,
      session: {
        id: 'sess-1', xp_earned: 50, question_count: 4, completed_at: '2026-07-20T10:00:00Z',
        skills: { name: 'Decimals', slug: 'math-decimals' },
      },
      answers: [
        { was_correct: true, position: 0 }, { was_correct: true, position: 1 },
        { was_correct: true, position: 2 }, { was_correct: true, position: 3 },
        // checkpoint questions, one wrong - must not drag down the recap
        { was_correct: false, position: 4 }, { was_correct: true, position: 5 },
      ],
    })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await getCheckinData()

    expect(result.due).toBe(true)
    if (!result.due) throw new Error('unreachable')
    expect(result.questionsAnswered).toBe(4)
    expect(result.correctCount).toBe(4)
    expect(result.accuracy).toBe(100)
  })
})

describe('dismissCheckin', () => {
  test('updates last_checkin_at for the current user', async () => {
    const client = clientForCheckin()
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await dismissCheckin()

    expect(result).toEqual({ success: true })
    expect(client._usersUpdate).toHaveBeenCalled()
  })
})
