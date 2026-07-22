export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GenerateBatchButton from '@/components/GenerateBatchButton'
import ReviewBundleCard, { type PassageBundle } from '@/components/ReviewBundleCard'

export default async function ReviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/dashboard')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const [{ data: pending }, { count: publishedCount }, { count: rejectedCount }] = await Promise.all([
    supabase
      .from('passages')
      .select('id, topic, text, reading_level, status, created_at, questions(id, prompt, choices, answer, explanation, question_kind)')
      .eq('status', 'pending')
      .order('created_at'),
    supabase.from('passages').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('passages').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
  ])

  const bundles = (pending ?? []) as unknown as PassageBundle[]

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header className="safe-top bg-white border-b-2 px-5 py-4 flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-xl font-black" style={{ color: 'var(--primary)' }}>📖 Content Review</h1>
        <a href="/admin" className="text-sm text-gray-400 font-semibold">← Usage</a>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between bg-white rounded-2xl border-2 p-4 flex-wrap gap-3" style={{ borderColor: 'var(--border)' }}>
          <div className="text-sm font-semibold text-gray-600">
            {bundles.length} pending · {publishedCount ?? 0} published · {rejectedCount ?? 0} rejected
          </div>
          <GenerateBatchButton />
        </div>

        {bundles.length === 0 && (
          <p className="text-gray-400 font-semibold text-center py-10">Nothing pending review. Generate a batch to get started.</p>
        )}

        {bundles.map(bundle => (
          <ReviewBundleCard key={bundle.id} bundle={bundle} />
        ))}
      </main>
    </div>
  )
}
