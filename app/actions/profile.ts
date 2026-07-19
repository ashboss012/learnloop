'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProfile(displayName: string, grade: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const trimmed = displayName.trim()
  if (!trimmed) return { error: 'Name cannot be empty' }
  if (trimmed.length > 40) return { error: 'Name is too long' }
  if (!Number.isInteger(grade) || grade < 1 || grade > 8) return { error: 'Grade must be between 1 and 8' }

  const { error } = await supabase.from('users').update({ display_name: trimmed, grade }).eq('id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/profile')
  revalidatePath('/dashboard')
  return { success: true }
}
