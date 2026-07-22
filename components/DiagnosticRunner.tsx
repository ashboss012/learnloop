'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { gradeAnswer } from '@/app/actions/session'
import { completeDiagnostic, getDiagnosticRound2 } from '@/app/actions/diagnostic'
import Mascot from '@/components/Mascot'

interface Choice { label: string; value: string }
interface Question { id: string; prompt: string; choices: Choice[] | null; difficulty: number; position: number }

type Phase = 'question' | 'feedback' | 'loading' | 'complete'

interface FeedbackState {
  correct: boolean
  correctAnswer: string
  explanation: string
  chosen: string
}

interface Props {
  sessionId: string
  subject: string
  totalQuestions: number
  initialQuestions: Question[]
}

const SUBJECT_TITLE: Record<string, string> = { math: 'Math Placement Exam', english: 'English Quick Check-In' }
const SUBJECT_LABEL: Record<string, string> = { math: 'Math', english: 'English' }

export default function DiagnosticRunner({ sessionId, subject, totalQuestions, initialQuestions }: Props) {
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>(initialQuestions)
  const [round2Fetched, setRound2Fetched] = useState(false)
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [phase, setPhase] = useState<Phase>('question')
  const [xpEarned, setXpEarned] = useState(0)

  const question = questions[index]
  const isLast = index >= totalQuestions - 1
  const progressPct = Math.round((index / totalQuestions) * 100)

  async function handleChoice(value: string) {
    if (phase !== 'question' || selected) return
    setSelected(value)
    const res = await gradeAnswer(sessionId, question.id, value, 1)
    if ('error' in res) return
    if (res.correct) setXpEarned(xp => xp + 5)
    setFeedback({ correct: res.correct, correctAnswer: res.correctAnswer, explanation: res.explanation, chosen: value })
    setPhase('feedback')
  }

  async function handleContinue() {
    if (isLast) {
      await completeDiagnostic(sessionId)
      setPhase('complete')
      return
    }

    const nextIndex = index + 1
    if (nextIndex >= questions.length && subject === 'math' && !round2Fetched) {
      setPhase('loading')
      const res = await getDiagnosticRound2(sessionId)
      if ('error' in res) { router.push('/dashboard'); return }
      setQuestions(prev => [...prev, ...res.questions])
      setRound2Fetched(true)
    }

    setIndex(nextIndex)
    setSelected(null)
    setFeedback(null)
    setPhase('question')
  }

  if (phase === 'complete') {
    return <DiagnosticCompleteScreen xp={xpEarned} subject={subject} onDone={() => router.push('/dashboard')} />
  }

  return (
    <div className="min-h-screen flex flex-col bg-blobs">
      <div className="safe-top sticky top-0 z-10 glass-bar border-b-2" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-lg mx-auto flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.push('/dashboard')}
            aria-label="Exit diagnostic"
            className="flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            style={{ width: 44, height: 44, fontSize: 22, lineHeight: 1 }}
          >
            ✕
          </button>
          <div className="flex-1 bg-gray-200 rounded-full overflow-hidden" style={{ height: 12 }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%`, background: 'var(--primary)' }}
            />
          </div>
          <span className="text-sm font-black tabular-nums" style={{ color: 'var(--muted)', minWidth: '3.5rem', textAlign: 'right' }}>
            {index + 1}/{totalQuestions}
          </span>
        </div>
      </div>

      <div className="max-w-lg mx-auto w-full px-5 pt-5 pb-2">
        <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--primary)' }}>
          {SUBJECT_TITLE[subject] ?? `${SUBJECT_LABEL[subject] ?? subject} Quick Check-In`}
        </span>
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 flex flex-col" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
        {phase === 'loading' && (
          <div className="flex-1 flex items-center justify-center">
            <div style={{ width: 48, height: 48, border: '5px solid #e5e7eb', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {(phase === 'question' || phase === 'feedback') && question && (
          <div key={question.id} className="question-enter flex-1 flex flex-col">
            <div
              className="rounded-3xl p-6 mb-5 font-black leading-snug"
              style={{ background: 'white', border: '2px solid var(--border)', fontSize: 'clamp(1.25rem, 5vw, 1.75rem)', minHeight: 110 }}
            >
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
                  <button
                    key={choice.value}
                    onClick={() => handleChoice(choice.value)}
                    disabled={phase === 'feedback'}
                    className="w-full text-left rounded-2xl font-bold transition-colors"
                    style={{
                      background: bg,
                      border: `2.5px solid ${border}`,
                      color: textColor,
                      fontSize: 'clamp(1rem, 4vw, 1.125rem)',
                      padding: '14px 20px',
                      minHeight: 56,
                      cursor: phase === 'feedback' ? 'default' : 'pointer',
                    }}
                  >
                    {choice.label}
                  </button>
                )
              })}
            </div>

            {phase === 'feedback' && feedback && (
              <div className="mt-5">
                <div
                  className="rounded-3xl p-5 mb-4"
                  style={{
                    background: feedback.correct ? '#dcfce7' : '#fee2e2',
                    animation: feedback.correct ? 'pop 0.4s ease-out' : 'shake 0.4s ease-in-out',
                  }}
                >
                  <p className="font-black text-xl mb-1" style={{ color: feedback.correct ? '#166534' : '#991b1b' }}>
                    {feedback.correct ? '✅ Correct!' : '❌ Not quite!'}
                  </p>
                  {!feedback.correct && (
                    <p className="font-semibold text-base mt-1" style={{ color: '#991b1b' }}>
                      The answer is <strong>{feedback.correctAnswer}</strong>
                    </p>
                  )}
                  <p className="text-sm font-semibold mt-2 text-gray-700 leading-relaxed">{feedback.explanation}</p>
                </div>
                <style>{`
                  @keyframes pop { 0% { transform: scale(0.9); opacity: 0; } 60% { transform: scale(1.03); opacity: 1; } 100% { transform: scale(1); } }
                  @keyframes shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
                `}</style>
                <button
                  onClick={handleContinue}
                  className="w-full rounded-2xl font-black text-white transition-all active:scale-95"
                  style={{ background: 'var(--primary)', fontSize: '1.25rem', padding: '16px 24px', minHeight: 60 }}
                >
                  {isLast ? "Let's go! 🎉" : 'Continue →'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function DiagnosticCompleteScreen({ xp, subject, onDone }: { xp: number; subject: string; onDone: () => void }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5 text-center safe-bottom page-enter"
      style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
    >
      <div className="mb-2">
        <Mascot mood="excited" size={120} />
      </div>

      <h1 className="font-black text-white mb-2" style={{ fontSize: 'clamp(2rem, 8vw, 2.5rem)' }}>You&apos;re all set!</h1>
      <p className="font-semibold mb-8" style={{ color: '#c4b5fd' }}>
        {SUBJECT_LABEL[subject] ?? subject} is set to your level — practice will start right where you are.
      </p>

      {xp > 0 && (
        <div className="bg-white rounded-3xl p-6 w-full mb-6" style={{ maxWidth: 360 }}>
          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-600 text-lg">XP Earned</span>
            <span className="font-black text-3xl" style={{ color: 'var(--xp)' }}>+{xp} ⚡</span>
          </div>
        </div>
      )}

      <button
        onClick={onDone}
        className="w-full bg-white rounded-2xl font-black transition-all active:scale-95"
        style={{ maxWidth: 360, color: 'var(--primary)', fontSize: '1.25rem', padding: '18px 24px', minHeight: 60 }}
      >
        See My Levels 🚀
      </button>
    </div>
  )
}
