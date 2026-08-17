'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { CharacterDesign } from '@/components/CharacterAvatar'

// A chest costs 20 minutes of cumulative learning time (see
// supabase/migrations/017_character_collection.sql's
// total_learning_seconds()) - easy constant to retune later.
const SECONDS_PER_CHEST = 20 * 60
const FULL_COLLECTION_XP_BONUS = 20

export interface CollectionCharacter {
  id: string
  name: string
  flavorText: string
  rarity: string
  design: CharacterDesign
  owned: boolean
}

type CharacterRow = { id: string; name: string; flavor_text: string; rarity: string; design: CharacterDesign }

async function getTotalSeconds(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<number> {
  const { data } = await supabase.rpc('total_learning_seconds', { uid: userId })
  return typeof data === 'number' ? data : 0
}

export async function getCollectionState() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const [{ data: profile }, { data: seasons }, { data: ownedRows }, totalSeconds] = await Promise.all([
    supabase.from('users').select('current_season, chests_opened_count').eq('id', user.id).single(),
    supabase.from('character_seasons').select('slug, name, icon').order('sort_order'),
    supabase.from('user_characters').select('character_id').eq('user_id', user.id),
    getTotalSeconds(supabase, user.id),
  ])
  if (!profile) return { error: 'Profile not found' }

  const chestsOpened = profile.chests_opened_count
  const chestsAvailable = Math.max(0, Math.floor(totalSeconds / SECONDS_PER_CHEST) - chestsOpened)
  const secondsToNextChest = SECONDS_PER_CHEST - (totalSeconds % SECONDS_PER_CHEST)

  const activeSeason = profile.current_season ?? seasons?.[0]?.slug ?? null
  const ownedIds = new Set((ownedRows ?? []).map(r => r.character_id))

  let characters: CollectionCharacter[] = []
  if (activeSeason) {
    const { data: seasonChars } = await supabase
      .from('characters')
      .select('id, name, flavor_text, rarity, design')
      .eq('season_slug', activeSeason)
      .order('sort_order')
    characters = ((seasonChars ?? []) as CharacterRow[]).map(c => ({
      id: c.id,
      name: c.name,
      flavorText: c.flavor_text,
      rarity: c.rarity,
      design: c.design,
      owned: ownedIds.has(c.id),
    }))
  }

  return {
    seasons: seasons ?? [],
    activeSeason,
    characters,
    chestsAvailable,
    secondsToNextChest,
    secondsPerChest: SECONDS_PER_CHEST,
  }
}

export async function selectSeason(slug: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('users').update({ current_season: slug }).eq('id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/collection')
  return { success: true }
}

export async function openChest() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('users')
    .select('current_season, chests_opened_count')
    .eq('id', user.id)
    .single()
  if (!profile) return { error: 'Profile not found' }

  const totalSeconds = await getTotalSeconds(supabase, user.id)
  const chestsAvailable = Math.floor(totalSeconds / SECONDS_PER_CHEST) - profile.chests_opened_count
  if (chestsAvailable <= 0) return { error: 'No chests available yet' }

  let season = profile.current_season
  if (!season) {
    const { data: firstSeason } = await supabase.from('character_seasons').select('slug').order('sort_order').limit(1).single()
    season = firstSeason?.slug ?? null
    if (season) await supabase.from('users').update({ current_season: season }).eq('id', user.id)
  }
  if (!season) return { error: 'No seasons available' }

  const [{ data: seasonChars }, { data: ownedRows }] = await Promise.all([
    supabase.from('characters').select('id, name, flavor_text, rarity, design').eq('season_slug', season),
    supabase.from('user_characters').select('character_id').eq('user_id', user.id),
  ])

  const ownedIds = new Set((ownedRows ?? []).map(r => r.character_id))
  const unowned = ((seasonChars ?? []) as CharacterRow[]).filter(c => !ownedIds.has(c.id))

  // Always spend the chest, whether it yields a new character or the
  // full-collection XP fallback below.
  await supabase.from('users').update({ chests_opened_count: profile.chests_opened_count + 1 }).eq('id', user.id)

  if (unowned.length === 0) {
    await supabase.rpc('increment_xp', { uid: user.id, amount: FULL_COLLECTION_XP_BONUS })
    revalidatePath('/collection')
    return { fullCollection: true as const, xpEarned: FULL_COLLECTION_XP_BONUS }
  }

  const picked = unowned[Math.floor(Math.random() * unowned.length)]
  const { error: insertError } = await supabase
    .from('user_characters')
    .insert({ user_id: user.id, character_id: picked.id })
  if (insertError) return { error: insertError.message }

  revalidatePath('/collection')
  return {
    fullCollection: false as const,
    character: {
      id: picked.id,
      name: picked.name,
      flavorText: picked.flavor_text,
      rarity: picked.rarity,
      design: picked.design,
    },
  }
}
