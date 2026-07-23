import { vi, describe, test, expect, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/questionGenerator', () => ({
  generateQuestion: vi.fn().mockImplementation((slug: string, tier: number) => ({
    prompt: `Q for ${slug} t${tier}`,
    choices: [{ label: '1', value: '1' }],
    answer: '1',
    explanation: 'because',
    type: 'multiple_choice',
  })),
}))

vi.mock('@/lib/supabase/server')

import { createClient } from '@/lib/supabase/server'
import { startDiagnostic, getDiagnosticRound2, completeDiagnostic } from '@/app/actions/diagnostic'

const USER_ID = 'user-1'
const SESS_ID = 'sess-1'

type MockClient = Awaited<ReturnType<typeof createClient>>

const MATH_SKILLS = Array.from({ length: 12 }, (_, i) => ({ id: `math-skill-${i}`, slug: `math-skill-${i}` }))

beforeEach(() => {
  vi.clearAllMocks()
})

// ── startDiagnostic ───────────────────────────────────────────────────────────

describe('startDiagnostic — question count per subject', () => {
  function clientForStart(subject: string, skills: { id: string; slug: string }[], diagnosticDone = false) {
    const insertedSessions: Record<string, unknown>[] = []
    const insertedQuestions: unknown[] = []
    const column = subject === 'math' ? 'math_diagnostic_done' : 'english_diagnostic_done'
    const tables: Record<string, unknown> = {
      users: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { [column]: diagnosticDone }, error: null }),
          }),
        }),
      },
      skills: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: skills, error: null }),
            }),
          }),
        }),
      },
      sessions: {
        insert: vi.fn().mockImplementation((row: Record<string, unknown>) => {
          insertedSessions.push(row)
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: SESS_ID }, error: null }),
            }),
          }
        }),
      },
      session_questions: {
        insert: vi.fn().mockImplementation((rows: unknown[]) => {
          insertedQuestions.push(...rows)
          return Promise.resolve({ data: null, error: null })
        }),
      },
    }
    return {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => tables[table] ?? {}),
      _insertedSessions: insertedSessions,
      _insertedQuestions: insertedQuestions,
    }
  }

  test('math: question_count is 24 (12 skills x 2 rounds), but only 12 questions generated up front', async () => {
    const client = clientForStart('math', MATH_SKILLS)
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    await startDiagnostic('math')

    expect(client._insertedSessions[0].question_count).toBe(24)
    expect(client._insertedQuestions.length).toBe(12)
  })

  test('english: question_count equals skill count (1 round), all generated up front', async () => {
    const englishSkills = Array.from({ length: 6 }, (_, i) => ({ id: `eng-skill-${i}`, slug: `eng-skill-${i}` }))
    const client = clientForStart('english', englishSkills)
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    await startDiagnostic('english')

    expect(client._insertedSessions[0].question_count).toBe(6)
    expect(client._insertedQuestions.length).toBe(6)
  })

  test('refuses to start if the subject is already diagnosed', async () => {
    const client = clientForStart('math', MATH_SKILLS, true)
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await startDiagnostic('math')

    expect((result as Record<string, unknown>).error).toBeTruthy()
    expect(client._insertedSessions.length).toBe(0)
  })
})

// ── getDiagnosticRound2 ───────────────────────────────────────────────────────

describe('getDiagnosticRound2', () => {
  function clientForRound2({
    correctBySkillIndex,
    existingRound2 = null as unknown[] | null,
  }: {
    correctBySkillIndex: boolean[]
    existingRound2?: unknown[] | null
  }) {
    const insertedRows: Record<string, unknown>[] = []
    const round1Answers = MATH_SKILLS.map((skill, i) => ({
      was_correct: correctBySkillIndex[i],
      session_questions: { skill_id: skill.id },
    }))

    const tables: Record<string, unknown> = {
      sessions: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { user_id: USER_ID, status: 'active', subject: 'math', kind: 'diagnostic' },
              error: null,
            }),
          }),
        }),
      },
      skills: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: MATH_SKILLS, error: null }),
          }),
        }),
      },
      session_questions: {
        select: vi.fn().mockImplementation(() => ({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: existingRound2 ?? [], error: null }),
            }),
          }),
        })),
        insert: vi.fn().mockImplementation((rows: Record<string, unknown>[]) => {
          insertedRows.push(...rows)
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: rows.map((r, i) => ({ id: `r2-${i}`, ...r })),
                error: null,
              }),
            }),
          }
        }),
      },
      session_answers: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: round1Answers, error: null }),
          }),
        }),
      },
    }
    return {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => tables[table] ?? {}),
      _insertedRows: insertedRows,
    }
  }

  test('correct round-1 skills get tier 5 (MAX_TIER), wrong get tier 1', async () => {
    const correctBySkillIndex = MATH_SKILLS.map((_, i) => i % 2 === 0) // even indices correct
    const client = clientForRound2({ correctBySkillIndex })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    await getDiagnosticRound2(SESS_ID)

    expect(client._insertedRows.length).toBe(12)
    for (let i = 0; i < MATH_SKILLS.length; i++) {
      const row = client._insertedRows.find(r => r.skill_id === MATH_SKILLS[i].id)
      expect(row, `no round-2 row for skill ${i}`).toBeTruthy()
      expect(row!.difficulty, `wrong tier for skill ${i}`).toBe(correctBySkillIndex[i] ? 5 : 1)
      expect(row!.position, `wrong position for skill ${i}`).toBe(12 + i)
    }
  })

  test('idempotent: returns existing round 2 instead of generating a second batch', async () => {
    const existing = MATH_SKILLS.map((s, i) => ({ id: `existing-${i}`, prompt: 'Q', choices: [], difficulty: 2, position: 12 + i }))
    const client = clientForRound2({ correctBySkillIndex: MATH_SKILLS.map(() => true), existingRound2: existing })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await getDiagnosticRound2(SESS_ID)

    expect((result as { questions: unknown[] }).questions).toEqual(existing)
    expect(client._insertedRows.length).toBe(0)
  })
})

// ── completeDiagnostic ────────────────────────────────────────────────────────

describe('completeDiagnostic — tier placement', () => {
  function clientForComplete(subject: string, answers: { skill_id: string; position: number; was_correct: boolean }[]) {
    const upserts: Record<string, unknown>[] = []
    const column = subject === 'math' ? 'math_diagnostic_done' : 'english_diagnostic_done'
    const tables: Record<string, unknown> = {
      sessions: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { user_id: USER_ID, status: 'active', subject, kind: 'diagnostic' },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
      },
      session_answers: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: answers.map(a => ({ was_correct: a.was_correct, session_questions: { skill_id: a.skill_id, position: a.position } })),
              error: null,
            }),
          }),
        }),
      },
      user_skill_progress: {
        upsert: vi.fn().mockImplementation((row: Record<string, unknown>) => {
          upserts.push(row)
          return Promise.resolve({ data: null, error: null })
        }),
      },
      users: {
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
      },
    }
    return {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => tables[table] ?? {}),
      _upserts: upserts,
      _column: column,
    }
  }

  test.each([
    ['round1 correct, round2 correct -> tier 5', true, true, 5],
    ['round1 correct, round2 wrong -> tier 3', true, false, 3],
    ['round1 wrong, round2 correct -> tier 3', false, true, 3],
    ['round1 wrong, round2 wrong -> tier 1', false, false, 1],
  ])('math 2-round combining: %s', async (_label, r1, r2, expectedTier) => {
    const client = clientForComplete('math', [
      { skill_id: 'skill-a', position: 0, was_correct: r1 },
      { skill_id: 'skill-a', position: 12, was_correct: r2 },
    ])
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    await completeDiagnostic(SESS_ID)

    const upsert = client._upserts.find(u => u.skill_id === 'skill-a')
    expect(upsert, 'no upsert for skill-a').toBeTruthy()
    expect(upsert!.tier).toBe(expectedTier)
  })

  test('english single-round: correct -> tier 5 (MAX_TIER), wrong -> tier 1', async () => {
    const client = clientForComplete('english', [
      { skill_id: 'skill-x', position: 0, was_correct: true },
      { skill_id: 'skill-y', position: 1, was_correct: false },
    ])
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    await completeDiagnostic(SESS_ID)

    expect(client._upserts.find(u => u.skill_id === 'skill-x')!.tier).toBe(5)
    expect(client._upserts.find(u => u.skill_id === 'skill-y')!.tier).toBe(1)
  })
})
