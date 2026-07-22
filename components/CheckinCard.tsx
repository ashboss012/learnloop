'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { dismissCheckin } from '@/app/actions/checkin'
import { SKILL_ICONS, SKILL_COLORS } from '@/lib/skillDisplay'

interface Props {
  skillName: string
  slug: string
  questionsAnswered: number
  correctCount: number
  accuracy: number | null
  xpEarned: number
}

export default function CheckinCard({ skillName, slug, questionsAnswered, correctCount, accuracy, xpEarned }: Props) {
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)
  const [saving, setSaving] = useState(false)

  if (dismissed) return null

  async function handleDismiss() {
    setSaving(true)
    await dismissCheckin()
    setDismissed(true)
    router.refresh()
  }

  return (
    <div className="rounded-3xl p-5 mb-6 bg-white border-2" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">📋</span>
        <h2 className="font-black text-lg">Last Session Recap</h2>
      </div>

      <div className="flex items-center gap-3 rounded-xl p-3 mb-4" style={{ background: 'var(--bg)' }}>
        <span style={{ fontSize: 26 }}>{SKILL_ICONS[slug] ?? '📐'}</span>
        <div className="flex-1 min-w-0">
          <div className="font-black text-base truncate" style={{ color: SKILL_COLORS[slug] ?? 'var(--text)' }}>
            {skillName}
          </div>
          <div className="text-xs font-semibold text-gray-500">
            {correctCount}/{questionsAnswered} correct{accuracy !== null && ` · ${accuracy}%`} · +{xpEarned} XP
          </div>
        </div>
      </div>

      <button
        onClick={handleDismiss}
        disabled={saving}
        className="w-full rounded-2xl font-black text-white transition-all active:scale-95"
        style={{ background: 'var(--primary)', fontSize: '1rem', padding: '12px 20px', minHeight: 48, opacity: saving ? 0.7 : 1 }}
      >
        Nice! 👍
      </button>
    </div>
  )
}
