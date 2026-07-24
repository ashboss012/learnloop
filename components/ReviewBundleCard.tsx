'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { approvePassageBundle, rejectPassageBundle, saveEditsAndPublish } from '@/app/actions/reviewActions'

interface Choice { label: string; value: string }
interface QuestionRow {
  id: string
  prompt: string
  choices: Choice[] | null
  answer: string
  explanation: string
  question_kind: string | null
}
export interface PassageBundle {
  id: string
  topic: string | null
  text: string
  reading_level: number
  status: string
  created_at: string
  questions: QuestionRow[]
}

const KIND_LABEL: Record<string, string> = {
  main_idea: 'Main idea', detail: 'Detail', vocabulary: 'Vocabulary', inference: 'Inference',
}

export default function ReviewBundleCard({ bundle }: { bundle: PassageBundle }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [passageText, setPassageText] = useState(bundle.text)
  const [questions, setQuestions] = useState(bundle.questions.map(q => ({ ...q, choices: q.choices ?? [] })))

  function updateQuestion(id: string, patch: Partial<(typeof questions)[number]>) {
    setQuestions(prev => prev.map(q => (q.id === id ? { ...q, ...patch } : q)))
  }
  function updateChoice(qId: string, index: number, value: string) {
    setQuestions(prev => prev.map(q => {
      if (q.id !== qId) return q
      return { ...q, choices: q.choices.map((c, i) => (i === index ? { label: value, value } : c)) }
    }))
  }

  async function handleApprove() {
    setSaving(true)
    await approvePassageBundle(bundle.id)
    router.refresh()
  }
  async function handleReject() {
    setSaving(true)
    await rejectPassageBundle(bundle.id)
    router.refresh()
  }
  async function handleSaveEdits() {
    setSaving(true)
    await saveEditsAndPublish(bundle.id, passageText, questions.map(q => ({
      id: q.id, prompt: q.prompt, choices: q.choices, answer: q.answer, explanation: q.explanation,
    })))
    router.refresh()
  }

  return (
    <div className="bg-white rounded-3xl border-2 p-5" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--primary)' }}>
          {bundle.topic ?? 'Reading passage'}
        </span>
        <span className="text-xs font-bold rounded-full px-2 py-0.5" style={{ background: 'var(--surface-alt)', color: 'var(--muted)' }}>
          Reading level {bundle.reading_level.toFixed(1)}
        </span>
      </div>

      {editing ? (
        <textarea
          value={passageText}
          onChange={e => setPassageText(e.target.value)}
          className="w-full rounded-xl border-2 p-3 text-sm mb-4"
          style={{ borderColor: 'var(--border)', minHeight: 140 }}
        />
      ) : (
        <p className="text-sm text-gray-700 leading-relaxed mb-4 whitespace-pre-wrap">{passageText}</p>
      )}

      <div className="space-y-3 mb-4">
        {questions.map(q => (
          <div key={q.id} className="rounded-xl p-3" style={{ background: 'var(--bg)' }}>
            <span className="text-xs font-black uppercase" style={{ color: 'var(--primary)' }}>
              {KIND_LABEL[q.question_kind ?? ''] ?? q.question_kind}
            </span>
            {editing ? (
              <input
                value={q.prompt}
                onChange={e => updateQuestion(q.id, { prompt: e.target.value })}
                className="w-full rounded-lg border-2 px-2 py-1 text-sm font-bold my-1"
                style={{ borderColor: 'var(--border)' }}
              />
            ) : (
              <p className="font-bold text-sm mt-1">{q.prompt}</p>
            )}
            <div className="space-y-1 mt-2">
              {q.choices.map((c, ci) => (
                <div key={ci} className="text-sm">
                  {editing ? (
                    <input
                      value={c.value}
                      onChange={e => updateChoice(q.id, ci, e.target.value)}
                      className="w-full rounded-lg border-2 px-2 py-1"
                      style={{ borderColor: c.value === q.answer ? 'var(--correct)' : 'var(--border)' }}
                    />
                  ) : (
                    <span style={{ color: c.value === q.answer ? 'var(--correct)' : undefined, fontWeight: c.value === q.answer ? 900 : 600 }}>
                      {c.value === q.answer ? '✓ ' : '· '}{c.value}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {editing && (
              <input
                value={q.answer}
                onChange={e => updateQuestion(q.id, { answer: e.target.value })}
                placeholder="Correct answer (must match a choice exactly)"
                className="w-full rounded-lg border-2 px-2 py-1 text-xs mt-2"
                style={{ borderColor: 'var(--border)' }}
              />
            )}
            <p className="text-xs text-gray-500 mt-2">{q.explanation}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {editing ? (
          <>
            <button
              onClick={handleSaveEdits}
              disabled={saving}
              className="flex-1 rounded-xl font-black text-white py-2 text-sm transition-all active:scale-95"
              style={{ background: 'var(--primary)', opacity: saving ? 0.6 : 1 }}
            >
              Save & publish
            </button>
            <button
              onClick={() => setEditing(false)}
              disabled={saving}
              className="rounded-xl font-bold px-4 py-2 text-sm"
              style={{ background: 'var(--surface-alt)' }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleApprove}
              disabled={saving}
              className="flex-1 rounded-xl font-black text-white py-2 text-sm transition-all active:scale-95"
              style={{ background: 'var(--correct)', opacity: saving ? 0.6 : 1 }}
            >
              Approve ✓
            </button>
            <button
              onClick={() => setEditing(true)}
              disabled={saving}
              className="rounded-xl font-bold px-4 py-2 text-sm"
              style={{ background: 'var(--surface-alt)' }}
            >
              Edit
            </button>
            <button
              onClick={handleReject}
              disabled={saving}
              className="rounded-xl font-bold px-4 py-2 text-sm text-white transition-all active:scale-95"
              style={{ background: 'var(--wrong)', opacity: saving ? 0.6 : 1 }}
            >
              Reject ✕
            </button>
          </>
        )}
      </div>
    </div>
  )
}
