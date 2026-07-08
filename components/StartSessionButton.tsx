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
      className="rounded-3xl p-5 text-left transition-all active:scale-95 hover:shadow-lg"
      style={{ background: color + '15', border: `2px solid ${color}30` }}
    >
      <div className="text-3xl mb-2">{loading ? '⏳' : icon}</div>
      <div className="font-black text-base" style={{ color }}>{skill.name}</div>
      <div className="text-xs font-semibold text-gray-400 mt-0.5">
        {loading ? 'Starting...' : 'Tap to practice'}
      </div>
    </button>
  )
}
