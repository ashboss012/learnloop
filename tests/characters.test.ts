import { vi, describe, test, expect, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server')

import { createClient } from '@/lib/supabase/server'
import { openChest, getCollectionState, createCustomCharacter } from '@/app/actions/characters'

type MockClient = Awaited<ReturnType<typeof createClient>>

const USER_ID = 'user-1'
const SEASON = 'ninja'

const CHAR_A = { id: 'char-a', name: 'Kai', flavor_text: 'Fast.', rarity: 'rare', design: { shape: 'ninja', color: '#111', accent: '#222' } }
const CHAR_B = { id: 'char-b', name: 'Hana', flavor_text: 'Strong.', rarity: 'common', design: { shape: 'ninja', color: '#333', accent: '#444' } }

beforeEach(() => {
  vi.clearAllMocks()
})

// ── openChest ──────────────────────────────────────────────────────────────────

function clientForOpenChest({
  chestsOpenedCount = 0,
  totalSeconds = 1200,
  ownedCharacterIds = [] as string[],
  seasonCharacters = [CHAR_A, CHAR_B],
  currentSeason = SEASON as string | null,
} = {}) {
  const rpc = vi.fn().mockImplementation((name: string) => {
    if (name === 'total_learning_seconds') return Promise.resolve({ data: totalSeconds, error: null })
    return Promise.resolve({ data: null, error: null })
  })

  let updatedChestsOpenedCount: number | null = null
  const insertedCharacterIds: string[] = []

  const tables: Record<string, unknown> = {
    users: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { current_season: currentSeason, chests_opened_count: chestsOpenedCount },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockImplementation((row: { chests_opened_count?: number }) => {
        if (row.chests_opened_count !== undefined) updatedChestsOpenedCount = row.chests_opened_count
        return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) }
      }),
    },
    characters: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: seasonCharacters, error: null }),
      }),
    },
    user_characters: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: ownedCharacterIds.map(id => ({ character_id: id })), error: null }),
      }),
      insert: vi.fn().mockImplementation((row: { character_id: string }) => {
        insertedCharacterIds.push(row.character_id)
        return Promise.resolve({ data: null, error: null })
      }),
    },
  }

  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    from: vi.fn().mockImplementation((table: string) => tables[table] ?? {}),
    rpc,
    _rpc: rpc,
    _getUpdatedChestsOpenedCount: () => updatedChestsOpenedCount,
    _insertedCharacterIds: insertedCharacterIds,
  }
  return client
}

describe('openChest', () => {
  test('awards a character and increments chests_opened_count', async () => {
    const client = clientForOpenChest({ chestsOpenedCount: 0, totalSeconds: 1200, ownedCharacterIds: [] })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await openChest()

    expect('error' in result).toBe(false)
    expect(client._insertedCharacterIds.length).toBe(1)
    expect(['char-a', 'char-b']).toContain(client._insertedCharacterIds[0])
    expect(client._getUpdatedChestsOpenedCount()).toBe(1)
  })

  test('never awards an already-owned character', async () => {
    const client = clientForOpenChest({ chestsOpenedCount: 0, totalSeconds: 1200, ownedCharacterIds: ['char-a'] })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await openChest()

    expect(client._insertedCharacterIds).toEqual(['char-b'])
    expect('character' in result && result.character?.id).toBe('char-b')
  })

  test('falls back to an XP bonus when the season is fully collected', async () => {
    const client = clientForOpenChest({ chestsOpenedCount: 0, totalSeconds: 1200, ownedCharacterIds: ['char-a', 'char-b'] })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await openChest()

    expect(client._insertedCharacterIds.length).toBe(0)
    expect('fullCollection' in result && result.fullCollection).toBe(true)
    const xpCalls = client._rpc.mock.calls.filter((c: unknown[]) => c[0] === 'increment_xp')
    expect(xpCalls.length).toBe(1)
    expect((xpCalls[0][1] as { amount: number }).amount).toBeGreaterThan(0)
    // the chest is still spent even though it didn't yield a new character
    expect(client._getUpdatedChestsOpenedCount()).toBe(1)
  })

  test('refuses when no chests are available yet', async () => {
    // floor(1200 / 1200) - 1 already-opened = 0 available
    const client = clientForOpenChest({ chestsOpenedCount: 1, totalSeconds: 1200 })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await openChest()

    expect('error' in result).toBe(true)
    expect(client._insertedCharacterIds.length).toBe(0)
    expect(client._getUpdatedChestsOpenedCount()).toBe(null)
  })

  test('chest math matches floor(seconds / 1200) - opened_count', async () => {
    // 2500s -> floor(2500/1200) = 2 earned; 1 already opened -> 1 available
    const client = clientForOpenChest({ chestsOpenedCount: 1, totalSeconds: 2500, ownedCharacterIds: [] })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await openChest()

    expect('error' in result).toBe(false)
    expect(client._getUpdatedChestsOpenedCount()).toBe(2)
  })
})

// ── getCollectionState ────────────────────────────────────────────────────────

function clientForCollectionState({
  currentSeason = SEASON as string | null,
  chestsOpenedCount = 0,
  totalSeconds = 600,
  ownedCharacterIds = [] as string[],
  seasons = [{ slug: 'ninja', name: 'Ninja Squad', icon: '🥷' }],
  seasonCharacters = [CHAR_A, CHAR_B],
  customCharacters = [] as { id: string; name: string; design: unknown }[],
} = {}) {
  const rpc = vi.fn().mockResolvedValue({ data: totalSeconds, error: null })
  const tables: Record<string, unknown> = {
    users: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { current_season: currentSeason, chests_opened_count: chestsOpenedCount },
            error: null,
          }),
        }),
      }),
    },
    character_seasons: {
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: seasons, error: null }),
      }),
    },
    user_characters: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: ownedCharacterIds.map(id => ({ character_id: id })), error: null }),
      }),
    },
    characters: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: seasonCharacters, error: null }),
        }),
      }),
    },
    custom_characters: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: customCharacters, error: null }),
        }),
      }),
    },
  }
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    from: vi.fn().mockImplementation((table: string) => tables[table] ?? {}),
    rpc,
  }
}

describe('getCollectionState', () => {
  test('reports chests available using floor(seconds / threshold) - opened_count', async () => {
    const client = clientForCollectionState({ totalSeconds: 2500, chestsOpenedCount: 1 })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await getCollectionState()

    expect('error' in result).toBe(false)
    if (!('error' in result)) expect(result.chestsAvailable).toBe(1)
  })

  test('marks owned vs locked characters correctly', async () => {
    const client = clientForCollectionState({ ownedCharacterIds: ['char-a'] })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await getCollectionState()

    if (!('error' in result)) {
      expect(result.characters.find(c => c.id === 'char-a')?.owned).toBe(true)
      expect(result.characters.find(c => c.id === 'char-b')?.owned).toBe(false)
    }
  })

  test('includes the user\'s custom characters', async () => {
    const custom = [{ id: 'custom-1', name: 'Zoom', design: { shape: 'ninja', color: '#000', accent: '#fff' } }]
    const client = clientForCollectionState({ customCharacters: custom })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await getCollectionState()

    if (!('error' in result)) expect(result.customCharacters).toEqual(custom)
  })
})

// ── createCustomCharacter ─────────────────────────────────────────────────────

function clientForCreateCustomCharacter({ insertError = null as string | null } = {}) {
  const inserted: { user_id: string; name: string; design: unknown }[] = []
  const table = {
    insert: vi.fn().mockImplementation((row: { user_id: string; name: string; design: unknown }) => {
      inserted.push(row)
      return {
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(
            insertError
              ? { data: null, error: { message: insertError } }
              : { data: { id: 'custom-1', name: row.name, design: row.design }, error: null }
          ),
        }),
      }
    }),
  }
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    from: vi.fn().mockImplementation((table_: string) => (table_ === 'custom_characters' ? table : {})),
    _inserted: inserted,
  }
}

describe('createCustomCharacter', () => {
  const design = { shape: 'ninja' as const, color: '#0ea5e9', accent: '#ffffff', pose: 'ready' as const }

  test('trims the name and saves the chosen design', async () => {
    const client = clientForCreateCustomCharacter()
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await createCustomCharacter('  Zoom  ', design)

    expect('error' in result).toBe(false)
    expect(client._inserted[0]).toEqual({ user_id: USER_ID, name: 'Zoom', design })
  })

  test('rejects a blank name without inserting a row', async () => {
    const client = clientForCreateCustomCharacter()
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await createCustomCharacter('   ', design)

    expect('error' in result).toBe(true)
    expect(client._inserted.length).toBe(0)
  })

  test('truncates names beyond 20 characters', async () => {
    const client = clientForCreateCustomCharacter()
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    await createCustomCharacter('A'.repeat(30), design)

    expect(client._inserted[0].name.length).toBe(20)
  })

  test('surfaces an insert error', async () => {
    const client = clientForCreateCustomCharacter({ insertError: 'db down' })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await createCustomCharacter('Zoom', design)

    expect('error' in result).toBe(true)
  })
})
