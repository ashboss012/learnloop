'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { dismissCheckin } from '@/app/actions/checkin'
import { SKILL_ICONS, SKILL_COLORS } from '@/lib/skillDisplay'
import type { SkillActivity } from '@/app/actions/checkin'

interface Props {
  sessionsCompleted: number
  questionsAnswered: number
  overallAccuracy: number | null
  skills: SkillActivity[]
}

export default function CheckinCard({ sessionsCompleted, questionsAnswered, overallAccuracy, skills }: Props) {
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

  const hasActivity = questionsAnswered > 0

  return (
    <div className="rounded-3xl p-5 mb-6 bg-white border-2" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">📋</span>
        <h2 className="font-black text-lg">Your 3-Day Check-In</h2>
      </div>

      {hasActivity ? (
        <>
          <p className="text-sm font-semibold text-gray-600 mb-4">
            {sessionsCompleted} session{sessionsCompleted === 1 ? '' : 's'} · {questionsAnswered} question{questionsAnswered === 1 ? '' : 's'}
            {overallAccuracy !== null && ` · ${overallAccuracy}% accuracy`}
          </p>
          <div className="space-y-2 mb-4">
            {skills.map(skill => (
              <div key={skill.skillId} className="flex items-center gap-3 rounded-xl p-2.5" style={{ background: 'var(--bg)' }}>
                <span style={{ fontSize: 22 }}>{SKILL_ICONS[skill.slug] ?? '📐'}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-sm truncate" style={{ color: SKILL_COLORS[skill.slug] ?? 'var(--text)' }}>
                    {skill.name}
                  </div>
                  <div className="text-xs font-semibold text-gray-500">
                    {skill.questionsAnswered} answered{skill.accuracy !== null && ` · ${skill.accuracy}%`}
                  </div>
                </div>
                <span
                  className="text-xs font-black rounded-full px-2 py-0.5 shrink-0"
                  style={{ background: 'white', color: SKILL_COLORS[skill.slug] ?? 'var(--primary)' }}
                >
                  Lv {skill.tier}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm font-semibold text-gray-600 mb-4">
          No practice the last few days — ready for a fresh start? 💪
        </p>
      )}

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
