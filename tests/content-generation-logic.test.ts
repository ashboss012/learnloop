import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server')

import { createClient } from '@/lib/supabase/server'
import { generateReadingBatch } from '@/app/actions/contentGeneration'

type MockClient = Awaited<ReturnType<typeof createClient>>

// Calibrated in tests/readability.test.ts: lands inside [3.0, 5.5].
const VALID_PASSAGE = `Maya loved to visit the library on Saturdays. She and her dad walked
down the quiet street. They opened the big wooden doors and went inside.
Tall shelves held many books about animals and faraway places. Maya
always picked a new adventure story to read before bed.`

// Calibrated in tests/readability.test.ts: scores well above the band.
const DENSE_PASSAGE = `Photosynthesis is the biochemical process through which autotrophic
organisms convert electromagnetic radiation into chemical energy,
utilizing chlorophyll-containing organelles to catalyze the
transformation of atmospheric carbon dioxide and water into
carbohydrates and molecular oxygen through a series of interdependent
enzymatic reactions.`

function validQuestions() {
  return [
    { kind: 'main_idea', prompt: 'What is this mostly about?', choices: ['Libraries', 'Sports', 'Cooking', 'Weather'], answer: 'Libraries', explanation: 'because' },
    { kind: 'detail', prompt: 'What day did Maya visit?', choices: ['Saturday', 'Sunday', 'Monday', 'Friday'], answer: 'Saturday', explanation: 'because' },
    { kind: 'vocabulary', prompt: 'What does "adventure" mean here?', choices: ['a boring task', 'an exciting experience', 'a sad event', 'a chore'], answer: 'an exciting experience', explanation: 'because' },
    { kind: 'inference', prompt: 'What can you infer about Maya?', choices: ['She dislikes reading', 'She enjoys reading', 'She is scared', 'She never goes outside'], answer: 'She enjoys reading', explanation: 'because' },
  ]
}

function draftJSON(overrides: Record<string, unknown> = {}, passage = VALID_PASSAGE) {
  return JSON.stringify({ topic: 'Library visit', passage, questions: validQuestions(), ...overrides })
}

function mockGeminiFetch(jsonText: string | null, { ok = true, wrapMarkdown = false } = {}) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    json: vi.fn().mockResolvedValue(
      jsonText === null
        ? {}
        : { candidates: [{ content: { parts: [{ text: wrapMarkdown ? '```json\n' + jsonText + '\n```' : jsonText }] } }] },
    ),
  }))
}

function clientForGenerate({ role = 'admin' as string, skillId = 'skill-rc', subject = 'english' } = {}) {
  const insertedPassages: Record<string, unknown>[] = []
  const insertedQuestions: Record<string, unknown>[] = []
  const deletedPassageIds: string[] = []
  let counter = 0

  const tables: Record<string, unknown> = {
    users: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { role }, error: null }),
        }),
      }),
    },
    skills: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: skillId, subject }, error: null }),
        }),
      }),
    },
    passages: {
      insert: vi.fn().mockImplementation((row: Record<string, unknown>) => {
        const id = `passage-${counter++}`
        const inserted = { id, ...row }
        insertedPassages.push(inserted)
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: inserted, error: null }),
          }),
        }
      }),
      delete: vi.fn().mockImplementation(() => ({
        eq: vi.fn().mockImplementation((_col: string, id: string) => {
          deletedPassageIds.push(id)
          return Promise.resolve({ data: null, error: null })
        }),
      })),
    },
    questions: {
      insert: vi.fn().mockImplementation((rows: Record<string, unknown>[]) => {
        insertedQuestions.push(...rows)
        return Promise.resolve({ data: null, error: null })
      }),
    },
  }

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
    from: vi.fn().mockImplementation((table: string) => tables[table] ?? {}),
    _insertedPassages: insertedPassages,
    _insertedQuestions: insertedQuestions,
    _deletedPassageIds: deletedPassageIds,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.GEMINI_API_KEY = 'test-key'
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.GEMINI_API_KEY
})

describe('generateReadingBatch', () => {
  test('valid draft inside the readability band: inserted as pending, choices shaped as {label,value}', async () => {
    mockGeminiFetch(draftJSON())
    const client = clientForGenerate()
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await generateReadingBatch(1)

    expect(result).toEqual({ inserted: 1, pending: 1, rejectedByReadability: 0, failed: 0 })
    expect(client._insertedPassages[0].status).toBe('pending')
    expect(client._insertedQuestions.length).toBe(4)
    for (const q of client._insertedQuestions) {
      const choices = q.choices as { label: string; value: string }[]
      expect(choices.length).toBe(4)
      expect(choices[0]).toEqual({ label: choices[0].value, value: choices[0].value })
    }
  })

  test('strips markdown code fences before parsing', async () => {
    mockGeminiFetch(draftJSON(), { wrapMarkdown: true })
    const client = clientForGenerate()
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await generateReadingBatch(1)

    expect(result).toEqual({ inserted: 1, pending: 1, rejectedByReadability: 0, failed: 0 })
  })

  test('readability outside the band: inserted as rejected, not pending', async () => {
    mockGeminiFetch(draftJSON({}, DENSE_PASSAGE))
    const client = clientForGenerate()
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await generateReadingBatch(1)

    expect(result).toEqual({ inserted: 1, pending: 0, rejectedByReadability: 1, failed: 0 })
    expect(client._insertedPassages[0].status).toBe('rejected')
    expect(client._insertedQuestions.every(q => q.status === 'rejected')).toBe(true)
  })

  test('wrong question count: nothing inserted, counted as failed', async () => {
    mockGeminiFetch(draftJSON({ questions: validQuestions().slice(0, 3) }))
    const client = clientForGenerate()
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await generateReadingBatch(1)

    expect(result).toEqual({ inserted: 0, pending: 0, rejectedByReadability: 0, failed: 1 })
    expect(client._insertedPassages.length).toBe(0)
    expect(client._insertedQuestions.length).toBe(0)
  })

  test('duplicate question kind: nothing inserted, counted as failed', async () => {
    const questions = validQuestions()
    questions[3] = { ...questions[3], kind: 'detail' } // now two "detail", zero "inference"
    mockGeminiFetch(draftJSON({ questions }))
    const client = clientForGenerate()
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await generateReadingBatch(1)

    expect(result).toEqual({ inserted: 0, pending: 0, rejectedByReadability: 0, failed: 1 })
  })

  test('answer does not match any choice: nothing inserted, counted as failed', async () => {
    const questions = validQuestions()
    questions[0] = { ...questions[0], answer: 'Something not in the choices' }
    mockGeminiFetch(draftJSON({ questions }))
    const client = clientForGenerate()
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await generateReadingBatch(1)

    expect(result).toEqual({ inserted: 0, pending: 0, rejectedByReadability: 0, failed: 1 })
  })

  test('unparseable Gemini response: counted as failed, no insert', async () => {
    mockGeminiFetch('not valid json{{{')
    const client = clientForGenerate()
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await generateReadingBatch(1)

    expect(result).toEqual({ inserted: 0, pending: 0, rejectedByReadability: 0, failed: 1 })
  })

  test('missing GEMINI_API_KEY: counted as failed, fetch never called', async () => {
    delete process.env.GEMINI_API_KEY
    mockGeminiFetch(draftJSON())
    const client = clientForGenerate()
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await generateReadingBatch(1)

    expect(result).toEqual({ inserted: 0, pending: 0, rejectedByReadability: 0, failed: 1 })
    expect(fetch).not.toHaveBeenCalled()
  })

  test('non-admin caller: forbidden, Gemini never called', async () => {
    mockGeminiFetch(draftJSON())
    const client = clientForGenerate({ role: 'student' })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await generateReadingBatch(1)

    expect(result).toEqual({ error: 'Forbidden' })
    expect(fetch).not.toHaveBeenCalled()
  })

  test('count is clamped to at most 3 attempts', async () => {
    mockGeminiFetch(draftJSON())
    const client = clientForGenerate()
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    await generateReadingBatch(10)

    expect(fetch).toHaveBeenCalledTimes(3)
  })

  test('count is clamped to at least 1 attempt', async () => {
    mockGeminiFetch(draftJSON())
    const client = clientForGenerate()
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    await generateReadingBatch(0)

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  test('question insert failure rolls back the passage insert', async () => {
    mockGeminiFetch(draftJSON())
    const client = clientForGenerate()
    const originalFrom = client.from
    const questionsTable = { insert: vi.fn().mockResolvedValue({ data: null, error: { message: 'insert failed' } }) }
    client.from = vi.fn().mockImplementation((table: string) => (table === 'questions' ? questionsTable : originalFrom(table)))
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await generateReadingBatch(1)

    expect(result).toEqual({ inserted: 0, pending: 0, rejectedByReadability: 0, failed: 1 })
    expect(client._deletedPassageIds.length).toBe(1)
  })
})
