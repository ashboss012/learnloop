'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { EquippedWardrobe } from '@/components/AvatarView'

// A student who's already collected everything still gets a daily chest
// payout - same full-collection fallback shape as app/actions/characters.ts.
const DAILY_CHEST_COIN_BONUS = 15

const RARITY_WEIGHTS: Record<string, number> = { common: 50, rare: 30, epic: 15, legendary: 5 }

const SLOT_COLUMN = {
  shirt: 'equipped_shirt',
  pants: 'equipped_pants',
  accessory: 'equipped_accessory',
} as const

type Slot = keyof typeof SLOT_COLUMN

export interface WardrobeItem {
  id: string
  slot: Slot
  name: string
  rarity: string
  design: Record<string, unknown>
  coinPrice: number
  owned: boolean
  equipped: boolean
}

type ItemRow = { id: string; slot: Slot; name: string; rarity: string; design: Record<string, unknown>; coin_price: number }
type ProfileRow = { coins: number; equipped_shirt: string | null; equipped_pants: string | null; equipped_accessory: string | null }

async function loadCatalogAndOwnership(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const [{ data: catalogRows }, { data: ownedRows }] = await Promise.all([
    supabase.from('wardrobe_items').select('id, slot, name, rarity, design, coin_price').order('sort_order'),
    supabase.from('user_wardrobe_items').select('item_id').eq('user_id', userId),
  ])
  return {
    catalog: (catalogRows ?? []) as ItemRow[],
    ownedIds: new Set((ownedRows ?? []).map(r => r.item_id as string)),
  }
}

function buildEquipped(catalog: ItemRow[], profile: ProfileRow): EquippedWardrobe {
  const byId = new Map(catalog.map(c => [c.id, c]))
  return {
    shirt: profile.equipped_shirt ? (byId.get(profile.equipped_shirt)?.design as EquippedWardrobe['shirt']) : undefined,
    pants: profile.equipped_pants ? (byId.get(profile.equipped_pants)?.design as EquippedWardrobe['pants']) : undefined,
    accessory: profile.equipped_accessory ? (byId.get(profile.equipped_accessory)?.design as EquippedWardrobe['accessory']) : undefined,
  }
}

function pickWeighted(items: ItemRow[]): ItemRow {
  const total = items.reduce((sum, i) => sum + (RARITY_WEIGHTS[i.rarity] ?? 10), 0)
  let roll = Math.random() * total
  for (const item of items) {
    roll -= RARITY_WEIGHTS[item.rarity] ?? 10
    if (roll <= 0) return item
  }
  return items[items.length - 1]
}

export async function getWardrobeState() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const [{ data: profile }, { catalog, ownedIds }, { data: chestAvailable }] = await Promise.all([
    supabase.from('users').select('coins, equipped_shirt, equipped_pants, equipped_accessory').eq('id', user.id).single(),
    loadCatalogAndOwnership(supabase, user.id),
    supabase.rpc('wardrobe_chest_available', { uid: user.id }),
  ])
  if (!profile) return { error: 'Profile not found' }

  const items: WardrobeItem[] = catalog.map(c => ({
    id: c.id,
    slot: c.slot,
    name: c.name,
    rarity: c.rarity,
    design: c.design,
    coinPrice: c.coin_price,
    owned: ownedIds.has(c.id),
    equipped: c.id === profile.equipped_shirt || c.id === profile.equipped_pants || c.id === profile.equipped_accessory,
  }))

  return {
    items,
    coins: profile.coins,
    equipped: buildEquipped(catalog, profile),
    chestAvailable: Boolean(chestAvailable),
  }
}

export async function openDailyChest() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: available } = await supabase.rpc('wardrobe_chest_available', { uid: user.id })
  if (!available) return { error: 'Daily chest not available yet' }

  const { catalog, ownedIds } = await loadCatalogAndOwnership(supabase, user.id)
  const unowned = catalog.filter(c => !ownedIds.has(c.id))

  // Always stamp the chest as opened for today, whether it yields an item
  // or the full-collection coin fallback below.
  await supabase.rpc('mark_wardrobe_chest_opened', { uid: user.id })

  if (unowned.length === 0) {
    await supabase.rpc('increment_coins', { uid: user.id, amount: DAILY_CHEST_COIN_BONUS })
    revalidatePath('/collection')
    return { fullCollection: true as const, coinsEarned: DAILY_CHEST_COIN_BONUS }
  }

  const picked = pickWeighted(unowned)
  const { error } = await supabase.from('user_wardrobe_items').insert({ user_id: user.id, item_id: picked.id })
  if (error) return { error: error.message }

  revalidatePath('/collection')
  return {
    fullCollection: false as const,
    item: { id: picked.id, slot: picked.slot, name: picked.name, rarity: picked.rarity, design: picked.design },
  }
}

export async function buyItem(itemId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const [{ data: profile }, { data: item }, { data: owned }] = await Promise.all([
    supabase.from('users').select('coins').eq('id', user.id).single(),
    supabase.from('wardrobe_items').select('id, coin_price').eq('id', itemId).single(),
    supabase.from('user_wardrobe_items').select('item_id').eq('user_id', user.id).eq('item_id', itemId).maybeSingle(),
  ])
  if (!profile || !item) return { error: 'Item not found' }
  if (owned) return { error: 'Already owned' }
  if (profile.coins < item.coin_price) return { error: 'Not enough coins' }

  const { error: insertError } = await supabase.from('user_wardrobe_items').insert({ user_id: user.id, item_id: itemId })
  if (insertError) return { error: insertError.message }

  await supabase.from('users').update({ coins: profile.coins - item.coin_price }).eq('id', user.id)

  revalidatePath('/collection')
  return { success: true }
}

export async function equipItem(itemId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const [{ data: item }, { data: owned }] = await Promise.all([
    supabase.from('wardrobe_items').select('id, slot').eq('id', itemId).single(),
    supabase.from('user_wardrobe_items').select('item_id').eq('user_id', user.id).eq('item_id', itemId).maybeSingle(),
  ])
  if (!item) return { error: 'Item not found' }
  if (!owned) return { error: 'You do not own this item' }

  const column = SLOT_COLUMN[item.slot as Slot]
  const { error } = await supabase.from('users').update({ [column]: itemId }).eq('id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/collection')
  return { success: true }
}
