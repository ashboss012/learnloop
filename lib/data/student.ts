import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

// Memoized per-request: the (tabs) layout and dashboard/page.tsx both need
// the current user without paying for a second auth round trip.
export const getAuthedUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

export const getHeaderData = cache(async (userId: string) => {
  const supabase = await createClient()
  const [{ data: profile }, { data: streak }] = await Promise.all([
    supabase.from('users').select('xp_total').eq('id', userId).single(),
    supabase.from('streaks').select('current_streak, freezes_available').eq('user_id', userId).single(),
  ])
  return {
    xp: profile?.xp_total ?? 0,
    currentStreak: streak?.current_streak ?? 0,
    freezes: streak?.freezes_available ?? 2,
  }
})
