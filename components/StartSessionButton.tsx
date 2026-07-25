'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { startSession } from '@/app/actions/session'
import { startDiagnostic } from '@/app/actions/diagnostic'
import { MAX_TIER } from '@/lib/mastery'

interface Props {
  skill: { id: string; name: string; slug: string; subject: string }
  color: string
  icon: string
  tier: number
  diagnosticDone: boolean
  dueForReview?: boolean
}

const READING_COMPREHENSION_SLUG = 'english-reading-comprehension'

export default function StartSessionButton({ skill, color, icon, tier, diagnosticDone, dueForReview = false }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const isReading = skill.slug === READING_COMPREHENSION_SLUG

  async function handleClick() {
    setLoading(true)
    if (!diagnosticDone) {
      const result = await startDiagnostic(skill.subject)
      if ('error' in result) {
        alert(result.error)
        setLoading(false)
        return
      }
      router.push(`/diagnostic/${result.sessionId}`)
      return
    }
    const result = await startSession(skill.id)
    if ('error' in result) {
      alert(result.error)
      setLoading(false)
      return
    }
    router.push(`/session/${result.sessionId}`)
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="btn-3d relative rounded-3xl text-left w-full"
      style={{
        background: 'var(--surface)',
        borderTopColor: `color-mix(in srgb, ${color} 35%, var(--border))`,
        borderLeftColor: `color-mix(in srgb, ${color} 35%, var(--border))`,
        borderRightColor: `color-mix(in srgb, ${color} 35%, var(--border))`,
        borderBottomColor: `color-mix(in srgb, ${color} 70%, black)`,
        padding: '20px 18px',
        minHeight: 110,
        opacity: loading ? 0.7 : 1,
      }}
    >
      {!isReading && (
        <span
          className="absolute top-3 right-3 text-xs font-black rounded-full px-2 py-0.5 text-white"
          style={{ background: color }}
        >
          Lv {tier}
        </span>
      )}
      {dueForReview && (
        <span
          className="absolute top-3 left-3 text-xs font-black rounded-full px-2 py-0.5 text-white"
          style={{ background: 'var(--xp)' }}
        >
          🔁 Review
        </span>
      )}
      <div className="relative inline-flex items-center justify-center mb-2" style={{ width: 48, height: 48 }}>
        {!isReading && (
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(${color} ${(tier / MAX_TIER) * 360}deg, color-mix(in srgb, ${color} 20%, var(--surface)) 0deg)`,
              WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
              mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
            }}
          />
        )}
        <span style={{ fontSize: 28, lineHeight: 1, position: 'relative' }}>{loading ? '⏳' : icon}</span>
      </div>
      <div className="font-black" style={{ color: 'var(--text)', fontSize: '1.05rem' }}>{skill.name}</div>
      <div className="font-semibold mt-1" style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
        {loading ? 'Starting…' : 'Tap to practice'}
      </div>
    </button>
  )
}
