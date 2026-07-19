export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import SessionRunner from '@/components/SessionRunner'
import { getSessionForRunner } from '@/app/actions/session'

interface Props {
  params: Promise<{ sessionId: string }>
}

export default async function SessionPage({ params }: Props) {
  const { sessionId } = await params
  const result = await getSessionForRunner(sessionId)
  if ('error' in result) redirect('/dashboard')

  return (
    <SessionRunner
      sessionId={sessionId}
      skillName={result.skillName}
      totalQuestions={result.questionCount}
      initialQuestion={result.question}
    />
  )
}
