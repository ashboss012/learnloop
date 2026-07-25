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
const NODE_SIZE = 74

// Renders one circular node on the skill path (components/SkillPath.tsx) -
// the click-to-start/routing logic below is the only place that logic
// lives, so the path never forks it.
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
    <button onClick={handleClick} disabled={loading} className="relative flex flex-col items-center gap-1.5" style={{ width: 92, opacity: loading ? 0.7 : 1 }}>
      <div className="relative">
        <div
          className="btn-3d relative rounded-full flex items-center justify-center"
          style={{
            width: NODE_SIZE,
            height: NODE_SIZE,
            background: 'var(--surface)',
            borderTopColor: `color-mix(in srgb, ${color} 35%, var(--border))`,
            borderLeftColor: `color-mix(in srgb, ${color} 35%, var(--border))`,
            borderRightColor: `color-mix(in srgb, ${color} 35%, var(--border))`,
            borderBottomColor: `color-mix(in srgb, ${color} 70%, black)`,
            borderBottomWidth: 6,
          }}
        >
          {!isReading && (
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(${color} ${(tier / MAX_TIER) * 360}deg, color-mix(in srgb, ${color} 20%, var(--surface)) 0deg)`,
                WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))',
                mask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))',
              }}
            />
          )}
          <span style={{ fontSize: 30, lineHeight: 1, position: 'relative' }}>{loading ? '⏳' : icon}</span>
        </div>
        {!isReading && (
          <span
            className="absolute -top-1.5 -right-1.5 text-[0.65rem] font-black rounded-full px-1.5 py-0.5 text-white"
            style={{ background: color, border: '2px solid var(--bg)' }}
          >
            {tier}
          </span>
        )}
        {dueForReview && (
          <span
            className="absolute -top-1.5 -left-1.5 text-xs rounded-full flex items-center justify-center"
            style={{ background: 'var(--xp)', border: '2px solid var(--bg)', width: 22, height: 22 }}
          >
            🔁
          </span>
        )}
      </div>
      <div className="font-black text-center leading-tight" style={{ color: 'var(--text)', fontSize: '0.72rem' }}>
        {skill.name}
      </div>
    </button>
  )
}
