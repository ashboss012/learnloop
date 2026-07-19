'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { startSession } from '@/app/actions/session'

interface Props {
  skill: { id: string; name: string; slug: string }
  color: string
  icon: string
  tier: number
}

export default function StartSessionButton({ skill, color, icon, tier }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleClick() {
    setLoading(true)
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
      className="relative rounded-3xl text-left transition-all active:scale-95 shadow-sm hover:shadow-md"
      style={{
        background: `linear-gradient(135deg, ${color}22, ${color}10)`,
        border: `2.5px solid ${color}40`,
        padding: '20px 18px',
        minHeight: 110,
        width: '100%',
        opacity: loading ? 0.7 : 1,
      }}
    >
      <span
        className="absolute top-3 right-3 text-xs font-black rounded-full px-2 py-0.5"
        style={{ background: 'white', color }}
      >
        Lv {tier}
      </span>
      <div className="relative inline-flex items-center justify-center mb-2" style={{ width: 48, height: 48 }}>
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(${color} ${(tier / 3) * 360}deg, ${color}20 0deg)`,
            WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
            mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
          }}
        />
        <span style={{ fontSize: 28, lineHeight: 1, position: 'relative' }}>{loading ? '⏳' : icon}</span>
      </div>
      <div className="font-black" style={{ color, fontSize: '1.05rem' }}>{skill.name}</div>
      <div className="font-semibold mt-1" style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
        {loading ? 'Starting…' : 'Tap to practice'}
      </div>
    </button>
  )
}
