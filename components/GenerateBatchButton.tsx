'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { generateReadingBatch } from '@/app/actions/contentGeneration'

export default function GenerateBatchButton() {
  const router = useRouter()
  const [count, setCount] = useState(1)
  const [loading, setLoading] = useState(false)
  const [lastResult, setLastResult] = useState<string | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setLastResult(null)
    const res = await generateReadingBatch(count)
    setLoading(false)
    if ('error' in res) { setLastResult(`Error: ${res.error}`); return }
    setLastResult(`+${res.pending} pending, ${res.rejectedByReadability} rejected (readability), ${res.failed} failed`)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      {lastResult && <span className="text-xs font-semibold text-gray-500">{lastResult}</span>}
      <select
        value={count}
        onChange={e => setCount(Number(e.target.value))}
        disabled={loading}
        className="rounded-xl border-2 px-2 py-1.5 text-sm font-bold"
        style={{ borderColor: 'var(--border)' }}
      >
        {[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
      </select>
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="rounded-xl font-black text-white px-4 py-2 text-sm transition-all active:scale-95"
        style={{ background: 'var(--primary)', opacity: loading ? 0.6 : 1 }}
      >
        {loading ? 'Generating…' : 'Generate batch ✨'}
      </button>
    </div>
  )
}
