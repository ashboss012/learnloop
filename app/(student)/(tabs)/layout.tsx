export const dynamic = 'force-dynamic'

import { getAuthedUser, getHeaderData } from '@/lib/data/student'
import TabBar from '@/components/TabBar'

export default async function TabsLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthedUser()
  const { xp, currentStreak, freezes } = await getHeaderData(user?.id ?? '')

  return (
    <div className="min-h-screen bg-blobs flex flex-col">
      <header className="safe-top sticky top-0 z-10 glass-bar border-b-2" style={{ borderColor: 'var(--border)' }}>
        <div className="px-4 py-3 flex items-center justify-between gap-2 max-w-lg mx-auto w-full">
          <span className="text-xl font-black shrink-0" style={{ color: 'var(--primary)' }}>🧠 LearnLoop</span>
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-1 font-black text-sm shrink-0" style={{ color: 'var(--xp)' }}>
              ⚡<span>{xp}</span>
            </div>
            <div className="flex items-center gap-1 font-black text-sm shrink-0" style={{ color: '#f97316' }}>
              🔥<span>{currentStreak}</span>
            </div>
            {freezes > 0 && (
              <div className="flex items-center gap-1 font-black text-sm shrink-0 text-blue-400">
                🧊<span>{freezes}</span>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1" style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom))' }}>
        {children}
      </main>
      <TabBar />
    </div>
  )
}
