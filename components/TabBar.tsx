'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/dashboard', label: 'Home', icon: '🏠' },
  { href: '/leaderboard', label: 'Leaders', icon: '🏆' },
  { href: '/stats', label: 'Stats', icon: '📊' },
  { href: '/profile', label: 'Profile', icon: '👤' },
]

export default function TabBar() {
  const pathname = usePathname()
  return (
    <nav className="safe-bottom fixed bottom-0 inset-x-0 z-20 glass-bar border-t-2" style={{ borderColor: 'var(--border)' }}>
      <div className="max-w-lg mx-auto grid grid-cols-4">
        {TABS.map(tab => {
          const active = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center justify-center gap-0.5"
              style={{ minHeight: 56, padding: '8px 0', color: active ? 'var(--primary)' : 'var(--muted)' }}
            >
              <span style={{ fontSize: 22, lineHeight: 1 }}>{tab.icon}</span>
              <span className="font-black" style={{ fontSize: '0.65rem' }}>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
