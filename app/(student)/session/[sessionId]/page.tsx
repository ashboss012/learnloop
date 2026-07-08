export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SessionRunner from '@/components/SessionRunner'

interface Props {
  params: Promise<{ sessionId: string }>
  searchParams: Promise<{ q?: string }>
}

export default async function SessionPage({ params, searchParams }: Props) {
  const { sessionId } = await params
  const { q } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!q) redirect('/dashboard')
  const questionIds = q.split(',').filter(Boolean)

  const { data: session } = await supabase
    .from('sessions')
    .select('*, skills(name)')
    .eq('id', sessionId)
    .single()

  if (!session || session.user_id !== user.id) redirect('/dashboard')
  if (session.status === 'completed') redirect('/dashboard')

  return (
    <SessionRunner
      sessionId={sessionId}
      questionIds={questionIds}
      skillName={(session.skills as { name: string })?.name ?? 'Math'}
    />
  )
}
