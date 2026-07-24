export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAuthedUser } from '@/lib/data/student'
import Mascot from '@/components/Mascot'
import ProfileForm from '@/components/ProfileForm'
import ThemeToggle from '@/components/ThemeToggle'

export default async function ProfilePage() {
  const supabase = await createClient()
  const user = await getAuthedUser()
  const userId = user?.id ?? ''

  const { data: profile } = await supabase
    .from('users')
    .select('display_name, grade, xp_total, created_at')
    .eq('id', userId)
    .single()

  const displayName = profile?.display_name ?? 'Explorer'
  const grade = profile?.grade ?? 4
  const xp = profile?.xp_total ?? 0
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null

  return (
    <div className="max-w-lg mx-auto px-4 py-8 page-enter">
      <div className="mb-6 flex items-center gap-3">
        <Mascot mood="happy" size={56} />
        <div>
          <h1 className="text-3xl font-black mb-1 tracking-tight">Your Profile 👤</h1>
          <p className="text-gray-500 font-semibold">Settings just for you.</p>
        </div>
      </div>

      <div className="rounded-2xl p-4 mb-4 bg-white border-2 flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <div>
          <div className="font-black text-2xl" style={{ color: 'var(--xp)' }}>⚡ {xp} XP</div>
          {memberSince && <div className="text-xs font-bold text-gray-400 mt-1">Practicing since {memberSince}</div>}
        </div>
      </div>

      <ProfileForm initialDisplayName={displayName} initialGrade={grade} />

      <div className="mt-4">
        <span className="block font-black text-sm mb-1.5">Appearance</span>
        <ThemeToggle />
      </div>
    </div>
  )
}
