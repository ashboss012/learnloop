'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getQuestion, gradeAnswer, completeSession } from '@/app/actions/session'

interface Choice { label: string; value: string }
interface Question { id: string; prompt: string; choices: Choice[] | null; difficulty: number; position: number }

type Phase = 'loading' | 'question' | 'feedback' | 'complete'

interface FeedbackState {
  correct: boolean
  correctAnswer: string
  explanation: string
  chosen: string
}

interface Props {
  sessionId: string
  questionIds: string[]
  skillName: string
}

export default function SessionRunner({ sessionId, questionIds, skillName }: Props) {
  const router = useRouter()
  const totalUnique = questionIds.length

  const [queue, setQueue] = useState<string[]>([...questionIds])
  const [firstAttempt, setFirstAttempt] = useState<Record<string, boolean | null>>({})
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [phase, setPhase] = useState<Phase>('loading')
  const [question, setQuestion] = useState<Question | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [completionData, setCompletionData] = useState<{ xp: number; streak: number } | null>(null)

  const currentQId = queue[0] ?? null

  const loadQuestion = useCallback(async (qId: string) => {
    setPhase('loading')
    setSelected(null)
    setFeedback(null)
    const res = await getQuestion(qId)
    if ('error' in res || !res.question) { router.push('/dashboard'); return }
    setQuestion(res.question as Question)
    setPhase('question')
  }, [router])

  useEffect(() => {
    if (currentQId) loadQuestion(currentQId)
  }, [currentQId, loadQuestion])

  async function handleChoice(value: string) {
    if (phase !== 'question' || !question || selected) return
    setSelected(value)
    const qId = question.id
    const isFirstAttempt = firstAttempt[qId] === undefined
    const attempt = isFirstAttempt ? 1 : 2
    const res = await gradeAnswer(sessionId, qId, value, attempt)
    if ('error' in res) return
    if (isFirstAttempt) setFirstAttempt(prev => ({ ...prev, [qId]: res.correct }))
    setFeedback({ correct: res.correct, correctAnswer: res.correctAnswer, explanation: res.explanation, chosen: value })
    setPhase('feedback')
    if (res.correct) setCompletedIds(prev => new Set([...prev, qId]))
  }

  async function handleContinue() {
    if (!question) return
    const qId = question.id
    const remaining = queue.slice(1)
    if (!feedback?.correct) remaining.push(qId)
    const newCompleted = feedback?.correct ? new Set([...completedIds, qId]) : completedIds
    if (newCompleted.size >= totalUnique && feedback?.correct) {
      const res = await completeSession(sessionId)
      const firstCorrectCount = Object.values(firstAttempt).filter(v => v === true).length
      setCompletionData({
        xp: 50 + firstCorrectCount * 5,
        streak: (res && typeof res === 'object' && 'streak' in res && typeof res.streak === 'number') ? res.streak : 0,
      })
      setPhase('complete')
      return
    }
    setQueue(remaining)
  }

  const progressPct = Math.round((completedIds.size / totalUnique) * 100)

  if (phase === 'complete' && completionData) {
    return <CompletionScreen xp={completionData.xp} streak={completionData.streak} onDone={() => router.push('/dashboard')} />
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <div className="sticky top-0 z-10 bg-white border-b-2 px-4 py-3" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-gray-600 font-bold text-xl leading-none">x</button>
          <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: 'var(--primary)' }} />
          </div>
          <span className="text-sm font-bold text-gray-400 min-w-14 text-right">{completedIds.size}/{totalUnique}</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto w-full px-4 pt-5 pb-2">
        <span className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--primary)' }}>{skillName}</span>
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 pb-8 flex flex-col">
        {phase === 'loading' && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-4xl animate-spin">*</div>
          </div>
        )}

        {(phase === 'question' || phase === 'feedback') && question && (
          <>
            <div className="rounded-3xl p-6 mb-6 text-2xl font-black leading-snug" style={{ background: 'white', border: '2px solid var(--border)', minHeight: 120 }}>
              {question.prompt}
            </div>

            <div className="space-y-3 flex-1">
              {question.choices?.map(choice => {
                let bg = 'white', border = 'var(--border)', textColor = 'var(--text)'
                if (phase === 'feedback' && feedback) {
                  if (choice.value === feedback.correctAnswer) { bg = '#dcfce7'; border = 'var(--correct)'; textColor = '#166534' }
                  else if (choice.value === feedback.chosen && !feedback.correct) { bg = '#fee2e2'; border = 'var(--wrong)'; textColor = '#991b1b' }
                }
                return (
                  <button key={choice.value} onClick={() => handleChoice(choice.value)} disabled={phase === 'feedback'}
                    className="w-full text-left rounded-2xl px-5 py-4 font-bold text-lg transition-all"
                    style={{ background: bg, border: `2px solid ${border}`, color: textColor }}>
                    {choice.label}
                  </button>
                )
              })}
            </div>

            {phase === 'feedback' && feedback && (
              <div className="mt-6">
                <div className="rounded-3xl p-5 mb-4" style={{ background: feedback.correct ? '#dcfce7' : '#fee2e2' }}>
                  <p className="font-black text-lg mb-1" style={{ color: feedback.correct ? '#166534' : '#991b1b' }}>
                    {feedback.correct ? 'Correct!' : 'Not quite!'}
                  </p>
                  {!feedback.correct && (
                    <p className="font-semibold text-sm" style={{ color: '#991b1b' }}>
                      The answer is <strong>{feedback.correctAnswer}</strong>
                    </p>
                  )}
                  <p className="text-sm font-semibold mt-2 text-gray-700">{feedback.explanation}</p>
                  {!feedback.correct && (
                    <p className="text-xs font-bold mt-2 text-orange-600">You will see this one again — keep going!</p>
                  )}
                </div>
                <button onClick={handleContinue} className="w-full py-4 rounded-2xl font-black text-xl text-white transition-all active:scale-95" style={{ background: 'var(--primary)' }}>
                  {feedback.correct && completedIds.size >= totalUnique - 1 ? 'Finish!' : 'Continue'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function CompletionScreen({ xp, streak, onDone }: { xp: number; streak: number; onDone: () => void }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVisible(true), 100); return () => clearTimeout(t) }, [])
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <div className={`transition-all duration-700 ${visible ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
        <div className="text-8xl mb-4">&#127942;</div>
      </div>
      <h1 className="text-4xl font-black text-white mb-2">You did it!</h1>
      <p className="text-purple-200 font-semibold mb-8">Session complete!</p>
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-bold text-gray-600">XP Earned</span>
          <span className="font-black text-2xl" style={{ color: 'var(--xp)' }}>+{xp}</span>
        </div>
        {streak > 0 && (
          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-600">Day Streak</span>
            <span className="font-black text-2xl text-orange-500">{streak} days</span>
          </div>
        )}
      </div>
      <button onClick={onDone} className="w-full max-w-sm py-4 rounded-2xl font-black text-xl bg-white transition-all active:scale-95" style={{ color: 'var(--primary)' }}>
        Back to Skills
      </button>
    </div>
  )
}
