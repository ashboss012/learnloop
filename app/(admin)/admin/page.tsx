export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

interface DailyRow { day: string; started: number; completed: number }
interface SkillRow { name: string; attempts: number; first_correct: number; accuracy: number }
interface StudentRow {
  display_name: string
  xp_total: number
  current_streak: number
  sessions_completed: number
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/dashboard')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  // ── 1. Sessions per day (last 14 days) ──────────────────────────────────
  const { data: dailyRaw } = await supabase.rpc('admin_sessions_per_day')

  // ── 2. First-attempt accuracy by skill ──────────────────────────────────
  const { data: skillRaw } = await supabase.rpc('admin_accuracy_by_skill')

  // ── 3. Student overview ─────────────────────────────────────────────────
  const { data: students } = await supabase
    .from('users')
    .select(`
      display_name,
      xp_total,
      streaks ( current_streak ),
      sessions ( id, status )
    `)
    .eq('role', 'student')
    .order('xp_total', { ascending: false })

  const studentRows: StudentRow[] = (students ?? []).map((s: {
    display_name: string
    xp_total: number
    streaks: { current_streak: number }[] | { current_streak: number } | null
    sessions: { id: string; status: string }[] | null
  }) => {
    const streakVal = Array.isArray(s.streaks)
      ? (s.streaks[0]?.current_streak ?? 0)
      : (s.streaks as { current_streak: number } | null)?.current_streak ?? 0
    return {
      display_name: s.display_name,
      xp_total: s.xp_total,
      current_streak: streakVal,
      sessions_completed: (s.sessions ?? []).filter((x: { status: string }) => x.status === 'completed').length,
    }
  })

  const daily: DailyRow[] = dailyRaw ?? []
  const skills: SkillRow[] = skillRaw ?? []

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header className="safe-top bg-white border-b-2 px-5 py-4 flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-xl font-black" style={{ color: 'var(--primary)' }}>🔬 Admin — Usage</h1>
        <form action="/api/auth/signout" method="POST">
          <button className="text-sm text-gray-400 font-semibold" style={{ minHeight: 44 }}>Sign out</button>
        </form>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-10">

        {/* Students */}
        <section>
          <h2 className="text-lg font-black mb-4">Students</h2>
          <div className="bg-white rounded-2xl overflow-hidden border-2" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', background: '#f9fafb' }}>
                  <th className="text-left px-4 py-3 font-black text-gray-600">Name</th>
                  <th className="text-right px-4 py-3 font-black text-gray-600">XP</th>
                  <th className="text-right px-4 py-3 font-black text-gray-600">Streak</th>
                  <th className="text-right px-4 py-3 font-black text-gray-600">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {studentRows.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-6 text-gray-400 font-semibold">No students yet</td></tr>
                )}
                {studentRows.map((s, i) => (
                  <tr key={i} style={{ borderBottom: i < studentRows.length - 1 ? '1px solid var(--border)' : undefined }}>
                    <td className="px-4 py-3 font-bold">{s.display_name}</td>
                    <td className="px-4 py-3 text-right font-black" style={{ color: 'var(--xp)' }}>⚡ {s.xp_total}</td>
                    <td className="px-4 py-3 text-right font-bold text-orange-500">🔥 {s.current_streak}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-700">{s.sessions_completed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Sessions per day */}
        <section>
          <h2 className="text-lg font-black mb-4">Sessions — last 14 days</h2>
          {daily.length === 0 ? (
            <p className="text-gray-400 font-semibold">No session data yet.</p>
          ) : (
            <div className="bg-white rounded-2xl overflow-hidden border-2" style={{ borderColor: 'var(--border)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', background: '#f9fafb' }}>
                    <th className="text-left px-4 py-3 font-black text-gray-600">Date</th>
                    <th className="text-right px-4 py-3 font-black text-gray-600">Started</th>
                    <th className="text-right px-4 py-3 font-black text-gray-600">Completed</th>
                    <th className="text-right px-4 py-3 font-black text-gray-600">Finish %</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.map((row, i) => (
                    <tr key={row.day} style={{ borderBottom: i < daily.length - 1 ? '1px solid var(--border)' : undefined }}>
                      <td className="px-4 py-3 font-semibold text-gray-700">{row.day}</td>
                      <td className="px-4 py-3 text-right font-bold">{row.started}</td>
                      <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--correct)' }}>{row.completed}</td>
                      <td className="px-4 py-3 text-right font-black" style={{ color: 'var(--primary)' }}>
                        {row.started > 0 ? Math.round((row.completed / row.started) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Accuracy by skill */}
        <section>
          <h2 className="text-lg font-black mb-4">First-attempt accuracy by skill</h2>
          {skills.length === 0 ? (
            <p className="text-gray-400 font-semibold">No answer data yet.</p>
          ) : (
            <div className="bg-white rounded-2xl overflow-hidden border-2" style={{ borderColor: 'var(--border)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', background: '#f9fafb' }}>
                    <th className="text-left px-4 py-3 font-black text-gray-600">Skill</th>
                    <th className="text-right px-4 py-3 font-black text-gray-600">Attempts</th>
                    <th className="text-right px-4 py-3 font-black text-gray-600">1st-try correct</th>
                    <th className="text-right px-4 py-3 font-black text-gray-600">Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {skills.map((row, i) => (
                    <tr key={row.name} style={{ borderBottom: i < skills.length - 1 ? '1px solid var(--border)' : undefined }}>
                      <td className="px-4 py-3 font-bold">{row.name}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-600">{row.attempts}</td>
                      <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--correct)' }}>{row.first_correct}</td>
                      <td className="px-4 py-3 text-right font-black" style={{ color: row.accuracy >= 70 ? 'var(--correct)' : row.accuracy >= 50 ? 'var(--xp)' : 'var(--wrong)' }}>
                        {row.accuracy}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </main>
    </div>
  )
}
