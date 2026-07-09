'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { startSession } from '@/app/actions/session'

interface Props {
  skill: { id: string; name: string; slug: string }
  color: string
  icon: string
}

export default function StartSessionButton({ skill, color, icon }: Props) {
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
    router.push(`/session/${result.sessionId}?q=${result.questionIds.join(',')}`)
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="rounded-3xl text-left transition-all active:scale-95"
      style={{
        background: color + '15',
        border: `2.5px solid ${color}40`,
        padding: '20px 18px',
        minHeight: 110,
        width: '100%',
        opacity: loading ? 0.7 : 1,
      }}
    >
      <div style={{ fontSize: 36, lineHeight: 1, marginBottom: 10 }}>{loading ? '⏳' : icon}</div>
      <div className="font-black" style={{ color, fontSize: '1.05rem' }}>{skill.name}</div>
      <div className="font-semibold mt-1" style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
        {loading ? 'Starting…' : 'Tap to practice'}
      </div>
    </button>
  )
}
