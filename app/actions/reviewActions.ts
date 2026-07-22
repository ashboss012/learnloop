'use server'

import { createClient } from '@/lib/supabase/server'
import { fleschKincaidGradeLevel } from '@/lib/readability'
import { revalidatePath } from 'next/cache'

type Supabase = Awaited<ReturnType<typeof createClient>>

async function requireAdmin(): Promise<{ supabase: Supabase } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Forbidden' }

  return { supabase }
}

export async function approvePassageBundle(passageId: string) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth
  const { supabase } = auth

  const now = new Date().toISOString()
  const { error: pErr } = await supabase.from('passages').update({ status: 'published', updated_at: now }).eq('id', passageId)
  if (pErr) return { error: pErr.message }
  const { error: qErr } = await supabase.from('questions').update({ status: 'published', updated_at: now }).eq('passage_id', passageId)
  if (qErr) return { error: qErr.message }

  revalidatePath('/admin/review')
  return { success: true }
}

export async function rejectPassageBundle(passageId: string, reason?: string) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth
  const { supabase } = auth

  const now = new Date().toISOString()
  const { error: pErr } = await supabase
    .from('passages')
    .update({ status: 'rejected', rejection_reason: reason ?? null, updated_at: now })
    .eq('id', passageId)
  if (pErr) return { error: pErr.message }
  const { error: qErr } = await supabase.from('questions').update({ status: 'rejected', updated_at: now }).eq('passage_id', passageId)
  if (qErr) return { error: qErr.message }

  revalidatePath('/admin/review')
  return { success: true }
}

interface QuestionEdit {
  id: string
  prompt: string
  choices: { label: string; value: string }[]
  answer: string
  explanation: string
}

export async function saveEditsAndPublish(passageId: string, passageText: string, questionEdits: QuestionEdit[]) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth
  const { supabase } = auth

  // Recomputed for the record - a human has already exercised judgment by
  // editing, so this doesn't re-block on the readability band.
  const readingLevel = fleschKincaidGradeLevel(passageText)
  const now = new Date().toISOString()

  const { error: pErr } = await supabase
    .from('passages')
    .update({ text: passageText, reading_level: readingLevel, status: 'published', updated_at: now })
    .eq('id', passageId)
  if (pErr) return { error: pErr.message }

  for (const q of questionEdits) {
    const { error: qErr } = await supabase
      .from('questions')
      .update({ prompt: q.prompt, choices: q.choices, answer: q.answer, explanation: q.explanation, status: 'published', updated_at: now })
      .eq('id', q.id)
    if (qErr) return { error: qErr.message }
  }

  revalidatePath('/admin/review')
  return { success: true }
}
