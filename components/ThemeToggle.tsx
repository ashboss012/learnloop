'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

const OPTIONS = [
  { value: 'light', label: '☀️ Light' },
  { value: 'dark', label: '🌙 Dark' },
  { value: 'system', label: '🖥️ Auto' },
] as const

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  // next-themes reads localStorage on mount - rendering the real value
  // during SSR would mismatch the client, so wait for mount before showing
  // which option is active (a common next-themes pattern).
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    // Documented next-themes hydration-safe pattern: `theme` is only
    // meaningful once mounted client-side, there's no render-time value
    // to compute instead.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  return (
    <div className="rounded-2xl p-1.5 flex gap-1 bg-white border-2" style={{ borderColor: 'var(--border)' }}>
      {OPTIONS.map(opt => {
        const active = mounted && theme === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className="flex-1 rounded-xl font-black text-sm transition-all active:scale-95"
            style={{
              padding: '10px 4px',
              minHeight: 44,
              background: active ? 'var(--primary)' : 'transparent',
              color: active ? '#ffffff' : 'var(--text)',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
