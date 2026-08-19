import { vi, describe, test, expect, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server')

import { createClient } from '@/lib/supabase/server'
import { openDailyChest, buyItem, equipItem } from '@/app/actions/wardrobe'

type MockClient = Awaited<ReturnType<typeof createClient>>

const USER_ID = 'user-1'
const ITEM_ID = 'item-shirt-1'

const ITEM_A = { id: 'item-a', slot: 'shirt', name: 'Red Tee', rarity: 'common', design: { color: '#ef4444' }, coin_price: 20 }
const ITEM_B = { id: 'item-b', slot: 'pants', name: 'Jeans', rarity: 'common', design: { color: '#000' }, coin_price: 20 }

beforeEach(() => {
  vi.clearAllMocks()
})

// ── openDailyChest ───────────────────────────────────────────────────────────

function clientForOpenDailyChest({
  available = true,
  ownedItemIds = [] as string[],
  catalog = [ITEM_A, ITEM_B],
} = {}) {
  const rpc = vi.fn().mockImplementation((name: string) => {
    if (name === 'wardrobe_chest_available') return Promise.resolve({ data: available, error: null })
    return Promise.resolve({ data: null, error: null })
  })

  const insertedItemIds: string[] = []

  const tables: Record<string, unknown> = {
    wardrobe_items: {
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: catalog, error: null }),
      }),
    },
    user_wardrobe_items: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: ownedItemIds.map(id => ({ item_id: id })), error: null }),
      }),
      insert: vi.fn().mockImplementation((row: { item_id: string }) => {
        insertedItemIds.push(row.item_id)
        return Promise.resolve({ data: null, error: null })
      }),
    },
  }

  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    from: vi.fn().mockImplementation((table: string) => tables[table] ?? {}),
    rpc,
    _rpc: rpc,
    _insertedItemIds: insertedItemIds,
  }
  return client
}

describe('openDailyChest', () => {
  test('awards an unowned item and stamps the chest as opened', async () => {
    const client = clientForOpenDailyChest({ ownedItemIds: [] })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await openDailyChest()

    expect('error' in result).toBe(false)
    expect(client._insertedItemIds.length).toBe(1)
    expect(['item-a', 'item-b']).toContain(client._insertedItemIds[0])
    const stampCalls = client._rpc.mock.calls.filter((c: unknown[]) => c[0] === 'mark_wardrobe_chest_opened')
    expect(stampCalls.length).toBe(1)
  })

  test('never awards an already-owned item', async () => {
    const client = clientForOpenDailyChest({ ownedItemIds: ['item-a'] })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await openDailyChest()

    expect(client._insertedItemIds).toEqual(['item-b'])
    expect('item' in result && result.item?.id).toBe('item-b')
  })

  test('falls back to a coin bonus when the whole catalog is owned', async () => {
    const client = clientForOpenDailyChest({ ownedItemIds: ['item-a', 'item-b'] })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await openDailyChest()

    expect(client._insertedItemIds.length).toBe(0)
    expect('fullCollection' in result && result.fullCollection).toBe(true)
    const coinCalls = client._rpc.mock.calls.filter((c: unknown[]) => c[0] === 'increment_coins')
    expect(coinCalls.length).toBe(1)
    expect((coinCalls[0][1] as { amount: number }).amount).toBeGreaterThan(0)
  })

  test('refuses when the daily gate is not met', async () => {
    const client = clientForOpenDailyChest({ available: false })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await openDailyChest()

    expect('error' in result).toBe(true)
    expect(client._insertedItemIds.length).toBe(0)
    const stampCalls = client._rpc.mock.calls.filter((c: unknown[]) => c[0] === 'mark_wardrobe_chest_opened')
    expect(stampCalls.length).toBe(0)
  })
})

// ── buyItem ──────────────────────────────────────────────────────────────────

function clientForBuyItem({ coins = 100, itemPrice = 20, alreadyOwned = false } = {}) {
  let updatedCoins: number | null = null
  const insertedItemIds: string[] = []

  const tables: Record<string, unknown> = {
    users: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { coins }, error: null }),
        }),
      }),
      update: vi.fn().mockImplementation((row: { coins?: number }) => {
        if (row.coins !== undefined) updatedCoins = row.coins
        return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) }
      }),
    },
    wardrobe_items: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: ITEM_ID, coin_price: itemPrice }, error: null }),
        }),
      }),
    },
    user_wardrobe_items: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: alreadyOwned ? { item_id: ITEM_ID } : null, error: null }),
          }),
        }),
      }),
      insert: vi.fn().mockImplementation((row: { item_id: string }) => {
        insertedItemIds.push(row.item_id)
        return Promise.resolve({ data: null, error: null })
      }),
    },
  }

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    from: vi.fn().mockImplementation((table: string) => tables[table] ?? {}),
    _getUpdatedCoins: () => updatedCoins,
    _insertedItemIds: insertedItemIds,
  }
}

describe('buyItem', () => {
  test('buys an unowned item within budget and deducts coins', async () => {
    const client = clientForBuyItem({ coins: 100, itemPrice: 20 })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await buyItem(ITEM_ID)

    expect('error' in result).toBe(false)
    expect(client._insertedItemIds).toEqual([ITEM_ID])
    expect(client._getUpdatedCoins()).toBe(80)
  })

  test('refuses when coins are insufficient', async () => {
    const client = clientForBuyItem({ coins: 10, itemPrice: 20 })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await buyItem(ITEM_ID)

    expect('error' in result).toBe(true)
    expect(client._insertedItemIds.length).toBe(0)
    expect(client._getUpdatedCoins()).toBe(null)
  })

  test('refuses to buy an already-owned item', async () => {
    const client = clientForBuyItem({ coins: 100, itemPrice: 20, alreadyOwned: true })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await buyItem(ITEM_ID)

    expect('error' in result).toBe(true)
    expect(client._insertedItemIds.length).toBe(0)
  })
})

// ── equipItem ────────────────────────────────────────────────────────────────

function clientForEquipItem({ owned = true, slot = 'shirt' as 'shirt' | 'pants' | 'accessory' } = {}) {
  let updatedColumn: Record<string, string> | null = null

  const tables: Record<string, unknown> = {
    wardrobe_items: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: ITEM_ID, slot }, error: null }),
        }),
      }),
    },
    user_wardrobe_items: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: owned ? { item_id: ITEM_ID } : null, error: null }),
          }),
        }),
      }),
    },
    users: {
      update: vi.fn().mockImplementation((row: Record<string, string>) => {
        updatedColumn = row
        return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) }
      }),
    },
  }

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    from: vi.fn().mockImplementation((table: string) => tables[table] ?? {}),
    _getUpdatedColumn: () => updatedColumn,
  }
}

describe('equipItem', () => {
  test('equips an owned item into its matching slot column', async () => {
    const client = clientForEquipItem({ owned: true, slot: 'pants' })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await equipItem(ITEM_ID)

    expect('error' in result).toBe(false)
    expect(client._getUpdatedColumn()).toEqual({ equipped_pants: ITEM_ID })
  })

  test('refuses to equip an item the student does not own', async () => {
    const client = clientForEquipItem({ owned: false })
    vi.mocked(createClient).mockResolvedValue(client as unknown as MockClient)

    const result = await equipItem(ITEM_ID)

    expect('error' in result).toBe(true)
    expect(client._getUpdatedColumn()).toBe(null)
  })
})
