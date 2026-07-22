export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import DiagnosticRunner from '@/components/DiagnosticRunner'
import { getDiagnosticForRunner } from '@/app/actions/diagnostic'

interface Props {
  params: Promise<{ sessionId: string }>
}

export default async function DiagnosticPage({ params }: Props) {
  const { sessionId } = await params
  const result = await getDiagnosticForRunner(sessionId)
  if ('error' in result) redirect('/dashboard')

  return (
    <DiagnosticRunner
      sessionId={sessionId}
      subject={result.subject}
      totalQuestions={result.questionCount}
      initialQuestions={result.questions}
    />
  )
}
