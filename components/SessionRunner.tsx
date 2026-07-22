'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { gradeAnswer, getNextQuestion, completeSession, getSkipCheckpoint, resolveSkipCheckpoint } from '@/app/actions/session'
import Mascot from '@/components/Mascot'

interface Choice { label: string; value: string }
interface Question { id: string; prompt: string; choices: Choice[] | null; difficulty: number; position: number; passage_text?: string | null }
interface MissedItem { question: Question; nextAttempt: number }

// Skip-ahead is offered once a student has aced this many primary
// questions in a row, with enough left that skipping actually saves them
// something. Mirrors app/actions/session.ts's own thresholds.
const SKIP_OFFER_MIN_ANSWERED = 4
const SKIP_OFFER_MIN_REMAINING = 2

type Phase = 'question' | 'feedback' | 'loading' | 'skip-offer' | 'complete'

interface FeedbackState {
  correct: boolean
  correctAnswer: string
  explanation: string
  chosen: string
}

interface Props {
  sessionId: string
  skillName: string
  totalQuestions: number
  initialQuestion: Question
}

export default function SessionRunner({ sessionId, skillName, totalQuestions, initialQuestion }: Props) {
  const router = useRouter()

  const [question, setQuestion] = useState<Question>(initialQuestion)
  const [primaryPosition, setPrimaryPosition] = useState(initialQuestion.position)
  const [reviewing, setReviewing] = useState(false)
  const [missedQueue, setMissedQueue] = useState<MissedItem[]>([])
  const [currentAttempt, setCurrentAttempt] = useState(1)
  const [firstAttemptCorrectCount, setFirstAttemptCorrectCount] = useState(0)

  const [skipOffered, setSkipOffered] = useState(false)
  const [lastPrimaryQuestion, setLastPrimaryQuestion] = useState<Question | null>(null)
  const [checkpointQuestions, setCheckpointQuestions] = useState<Question[] | null>(null)
  const [checkpointIndex, setCheckpointIndex] = useState(0)

  const [phase, setPhase] = useState<Phase>('question')
  const [selected, setSelected] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [completionData, setCompletionData] = useState<{ xp: number; streak: number; perfect: boolean; leveledUp: boolean; skippedAhead: boolean } | null>(null)

  async function handleChoice(value: string) {
    if (phase !== 'question' || selected) return
    setSelected(value)
    const attempt = reviewing ? currentAttempt : 1
    const res = await gradeAnswer(sessionId, question.id, value, attempt)
    if ('error' in res) return
    if (attempt === 1 && res.correct) setFirstAttemptCorrectCount(c => c + 1)
    setFeedback({ correct: res.correct, correctAnswer: res.correctAnswer, explanation: res.explanation, chosen: value })
    setPhase('feedback')
  }

  async function finishSession() {
    const res = await completeSession(sessionId)
    const r = res as Record<string, unknown>
    setCompletionData({
      xp: 50 + firstAttemptCorrectCount * 5,
      streak: typeof r.streak === 'number' ? r.streak : 0,
      perfect: r.perfect === true,
      leveledUp: r.leveledUp === true,
      skippedAhead: false,
    })
    setPhase('complete')
  }

  async function declineSkip() {
    setPhase('loading')
    const res = await getNextQuestion(sessionId, question.id)
    if ('error' in res) { router.push('/dashboard'); return }
    setQuestion(res.question as Question)
    setPrimaryPosition(res.question.position)
    setSelected(null)
    setFeedback(null)
    setPhase('question')
  }

  async function acceptSkip() {
    setPhase('loading')
    const res = await getSkipCheckpoint(sessionId)
    if ('error' in res) { router.push('/dashboard'); return }
    const questions = res.questions as Question[]
    setCheckpointQuestions(questions)
    setCheckpointIndex(0)
    setQuestion(questions[0])
    setSelected(null)
    setFeedback(null)
    setPhase('question')
  }

  async function advanceFromReview(justAnsweredCorrect: boolean, justAnsweredQuestion: Question) {
    const nextMissed = justAnsweredCorrect
      ? missedQueue
      : [...missedQueue, { question: justAnsweredQuestion, nextAttempt: currentAttempt + 1 }]

    if (nextMissed.length === 0) {
      await finishSession()
      return
    }

    const [next, ...rest] = nextMissed
    setMissedQueue(rest)
    setCurrentAttempt(next.nextAttempt)
    setQuestion(next.question)
    setSelected(null)
    setFeedback(null)
    setPhase('question')
  }

  async function handleContinue() {
    if (!feedback) return

    if (checkpointQuestions) {
      const nextIndex = checkpointIndex + 1
      if (nextIndex < checkpointQuestions.length) {
        setCheckpointIndex(nextIndex)
        setQuestion(checkpointQuestions[nextIndex])
        setSelected(null)
        setFeedback(null)
        setPhase('question')
        return
      }
      setPhase('loading')
      const res = await resolveSkipCheckpoint(sessionId)
      if ('error' in res) { router.push('/dashboard'); return }
      if (res.passed) {
        setCompletionData({
          xp: res.xpEarned,
          streak: typeof res.streak === 'number' ? res.streak : 0,
          perfect: false,
          leveledUp: false,
          skippedAhead: true,
        })
        setPhase('complete')
        return
      }
      // Missed the checkpoint - resume the normal session right where it left off.
      setCheckpointQuestions(null)
      const resumeFrom = lastPrimaryQuestion!
      const nextRes = await getNextQuestion(sessionId, resumeFrom.id)
      if ('error' in nextRes) { router.push('/dashboard'); return }
      setQuestion(nextRes.question as Question)
      setPrimaryPosition(nextRes.question.position)
      setSelected(null)
      setFeedback(null)
      setPhase('question')
      return
    }

    if (reviewing) {
      await advanceFromReview(feedback.correct, question)
      return
    }

    // Primary pass: never retry immediately - a miss goes to the review queue.
    const updatedMissed = feedback.correct ? missedQueue : [...missedQueue, { question, nextAttempt: 2 }]
    if (!feedback.correct) setMissedQueue(updatedMissed)

    const isLastPrimary = primaryPosition >= totalQuestions - 1
    if (!isLastPrimary) {
      const answeredSoFar = primaryPosition + 1
      const remaining = totalQuestions - answeredSoFar
      const eligibleForSkip = !skipOffered && updatedMissed.length === 0 && !question.passage_text
        && answeredSoFar >= SKIP_OFFER_MIN_ANSWERED && remaining >= SKIP_OFFER_MIN_REMAINING
      if (eligibleForSkip) {
        setSkipOffered(true)
        setLastPrimaryQuestion(question)
        setSelected(null)
        setFeedback(null)
        setPhase('skip-offer')
        return
      }

      setPhase('loading')
      const res = await getNextQuestion(sessionId, question.id)
      if ('error' in res) { router.push('/dashboard'); return }
      setQuestion(res.question as Question)
      setPrimaryPosition(res.question.position)
      setSelected(null)
      setFeedback(null)
      setPhase('question')
      return
    }

    // Last primary question just answered - transition to review or finish.
    if (updatedMissed.length === 0) {
      await finishSession()
      return
    }
    const [first, ...rest] = updatedMissed
    setReviewing(true)
    setMissedQueue(rest)
    setCurrentAttempt(first.nextAttempt)
    setQuestion(first.question)
    setSelected(null)
    setFeedback(null)
    setPhase('question')
  }

  const progressPct = Math.round(((primaryPosition + (reviewing || phase === 'complete' ? 1 : 0)) / totalQuestions) * 100)

  if (phase === 'complete' && completionData) {
    return (
      <CompletionScreen
        xp={completionData.xp}
        streak={completionData.streak}
        perfect={completionData.perfect}
        leveledUp={completionData.leveledUp}
        skippedAhead={completionData.skippedAhead}
        onDone={() => router.push('/dashboard')}
      />
    )
  }

  if (phase === 'skip-offer') {
    return <SkipOfferScreen onAccept={acceptSkip} onDecline={declineSkip} />
  }

  const isLastPrimary = !reviewing && primaryPosition >= totalQuestions - 1
  const checkpointMode = checkpointQuestions !== null
  const isLastCheckpoint = checkpointMode && checkpointIndex >= checkpointQuestions!.length - 1
  const isReading = Boolean(question.passage_text)

  return (
    <div className="min-h-screen flex flex-col bg-blobs">
      {/* Top bar — sticky, safe-area aware */}
      <div className="safe-top sticky top-0 z-10 bg-white border-b-2" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-lg mx-auto flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.push('/dashboard')}
            aria-label="Exit session"
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
            {Math.min(primaryPosition + 1, totalQuestions)}/{totalQuestions}
          </span>
        </div>
      </div>

      {/* Skill label */}
      <div className="max-w-lg mx-auto w-full px-5 pt-5 pb-2 flex items-center gap-2">
        <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--primary)' }}>{skillName}</span>
        {!isReading && (
          <span
            className="text-xs font-black rounded-full px-2 py-0.5"
            style={{ background: 'rgba(108,99,255,0.13)', color: 'var(--primary)' }}
          >
            Lv {question.difficulty}
          </span>
        )}
      </div>

      {reviewing && (
        <div className="max-w-lg mx-auto w-full px-5 pb-2">
          <span className="text-xs font-black rounded-full px-3 py-1 inline-block" style={{ background: '#fef3c7', color: '#92400e' }}>
            🔁 Missed questions — {missedQueue.length + 1} to clear
          </span>
        </div>
      )}

      {checkpointMode && (
        <div className="max-w-lg mx-auto w-full px-5 pb-2">
          <span className="text-xs font-black rounded-full px-3 py-1 inline-block" style={{ background: '#ede9fe', color: '#5b21b6' }}>
            🎯 Bonus checkpoint — ace both to skip ahead!
          </span>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 max-w-lg mx-auto w-full px-4 flex flex-col" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>

        {phase === 'loading' && (
          <div className="flex-1 flex items-center justify-center">
            <div style={{ width: 48, height: 48, border: '5px solid #e5e7eb', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {(phase === 'question' || phase === 'feedback') && question && (
          <>
            {isReading && question.passage_text && (
              <div
                className="rounded-3xl p-5 mb-4 text-sm leading-relaxed whitespace-pre-wrap"
                style={{ background: '#f9fafb', border: '2px solid var(--border)', color: 'var(--text)', maxHeight: 260, overflowY: 'auto' }}
              >
                {question.passage_text}
              </div>
            )}
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
                  {!feedback.correct && (
                    <p className="text-sm font-bold mt-2 text-orange-600">
                      {checkpointMode
                        ? "No worries — you'll just finish the rest of the lesson normally. 💪"
                        : reviewing ? "You'll see this one again soon — keep going! 💪" : "No worries — we'll come back to this one at the end! 💪"}
                    </p>
                  )}
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
                  {checkpointMode
                    ? (isLastCheckpoint ? 'See Results 🎯' : 'Continue →')
                    : feedback.correct && missedQueue.length === 0 && (reviewing || isLastPrimary)
                      ? 'Finish! 🎉'
                      : 'Continue →'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function CompletionScreen({
  xp, streak, perfect, leveledUp, skippedAhead, onDone,
}: {
  xp: number
  streak: number
  perfect: boolean
  leveledUp: boolean
  skippedAhead: boolean
  onDone: () => void
}) {
  const celebrate = perfect || skippedAhead
  useEffect(() => {
    let cancelled = false
    import('canvas-confetti').then(({ default: confetti }) => {
      if (cancelled) return
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 }, colors: ['#6c63ff', '#f59e0b', '#22c55e'] })
      if (celebrate) {
        setTimeout(() => { if (!cancelled) confetti({ particleCount: 150, spread: 120, origin: { y: 0.5 }, colors: ['#f59e0b', '#d946ef', '#6c63ff'] }) }, 300)
      }
    })
    return () => { cancelled = true }
  }, [celebrate])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5 text-center safe-bottom"
      style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
    >
      <div className="mb-2">
        <Mascot mood="excited" size={120} />
      </div>

      {perfect && (
        <span
          className="font-black rounded-full px-4 py-1.5 mb-3 inline-block"
          style={{ background: 'rgba(255,255,255,0.15)', color: '#fef3c7', fontSize: '0.9rem' }}
        >
          🌟 Perfect Run! 🌟
        </span>
      )}
      {!perfect && skippedAhead && (
        <span
          className="font-black rounded-full px-4 py-1.5 mb-3 inline-block"
          style={{ background: 'rgba(255,255,255,0.15)', color: '#fef3c7', fontSize: '0.9rem' }}
        >
          🎯 Nailed the Checkpoint!
        </span>
      )}

      <h1 className="font-black text-white mb-2" style={{ fontSize: 'clamp(2rem, 8vw, 2.5rem)' }}>You did it!</h1>
      <p className="font-semibold mb-8" style={{ color: '#c4b5fd' }}>
        {skippedAhead ? 'Skipped the rest — nice work!' : 'Session complete!'}
      </p>

      <div className="bg-white rounded-3xl p-6 w-full mb-6" style={{ maxWidth: 360 }}>
        <div className="flex items-center justify-between mb-3">
          <span className="font-bold text-gray-600 text-lg">XP Earned</span>
          <span className="font-black text-3xl" style={{ color: 'var(--xp)' }}>+{xp} ⚡</span>
        </div>
        {streak > 0 && (
          <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <span className="font-bold text-gray-600 text-lg">Day Streak</span>
            <span className="font-black text-3xl text-orange-500">🔥 {streak}</span>
          </div>
        )}
        {(leveledUp || skippedAhead) && (
          <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <span className="font-bold text-gray-600 text-lg">Skipped Ahead</span>
            <span className="font-black text-2xl" style={{ color: 'var(--primary)' }}>🚀 Lv 3</span>
          </div>
        )}
      </div>

      <button
        onClick={onDone}
        className="w-full bg-white rounded-2xl font-black transition-all active:scale-95"
        style={{ maxWidth: 360, color: 'var(--primary)', fontSize: '1.25rem', padding: '18px 24px', minHeight: 60 }}
      >
        Back to Skills 🚀
      </button>
    </div>
  )
}

function SkipOfferScreen({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5 text-center safe-bottom"
      style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
    >
      <div className="mb-4">
        <Mascot mood="excited" size={120} />
      </div>

      <h1 className="font-black text-white mb-2" style={{ fontSize: 'clamp(1.75rem, 7vw, 2.25rem)' }}>You&apos;re on fire! 🔥</h1>
      <p className="font-semibold mb-8 max-w-xs" style={{ color: '#c4b5fd' }}>
        Want to skip ahead? Ace 2 tough questions and finish the lesson early.
      </p>

      <div className="w-full space-y-3" style={{ maxWidth: 360 }}>
        <button
          onClick={onAccept}
          className="w-full bg-white rounded-2xl font-black transition-all active:scale-95"
          style={{ color: 'var(--primary)', fontSize: '1.25rem', padding: '18px 24px', minHeight: 60 }}
        >
          Let&apos;s go! 🚀
        </button>
        <button
          onClick={onDecline}
          className="w-full rounded-2xl font-black text-white transition-all active:scale-95"
          style={{ background: 'rgba(255,255,255,0.15)', fontSize: '1.05rem', padding: '14px 24px', minHeight: 52 }}
        >
          Keep practicing
        </button>
      </div>
    </div>
  )
}
