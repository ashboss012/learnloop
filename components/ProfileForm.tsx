'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateProfile } from '@/app/actions/profile'

interface Props {
  initialDisplayName: string
  initialGrade: number
}

export default function ProfileForm({ initialDisplayName, initialGrade }: Props) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [grade, setGrade] = useState(initialGrade)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    const result = await updateProfile(displayName, grade)
    setSaving(false)
    if ('error' in result) {
      setError(result.error ?? 'Something went wrong')
      return
    }
    setSaved(true)
    router.refresh()
  }

  return (
    <div className="rounded-3xl p-5 bg-white border-2" style={{ borderColor: 'var(--border)' }}>
      <label className="block mb-4">
        <span className="block font-black text-sm mb-1.5">Name</span>
        <input
          type="text"
          value={displayName}
          onChange={e => { setDisplayName(e.target.value); setSaved(false) }}
          className="w-full rounded-xl font-bold px-4"
          style={{ border: '2px solid var(--border)', minHeight: 48, fontSize: '1rem' }}
        />
      </label>

      <label className="block mb-2">
        <span className="block font-black text-sm mb-1.5">Grade</span>
        <select
          value={grade}
          onChange={e => { setGrade(Number(e.target.value)); setSaved(false) }}
          className="w-full rounded-xl font-bold px-4"
          style={{ border: '2px solid var(--border)', minHeight: 48, fontSize: '1rem' }}
        >
          {Array.from({ length: 8 }, (_, i) => i + 1).map(g => (
            <option key={g} value={g}>Grade {g}</option>
          ))}
        </select>
      </label>
      <p className="text-xs font-semibold text-gray-400 mb-4">
        Changing grade only sets the starting difficulty for skills he hasn&apos;t practiced yet — it won&apos;t move a skill he&apos;s already working on.
      </p>

      {error && <p className="text-sm font-bold mb-3" style={{ color: 'var(--wrong)' }}>{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-2xl font-black text-white transition-all active:scale-95"
        style={{ background: 'var(--primary)', fontSize: '1rem', padding: '14px 20px', minHeight: 52, opacity: saving ? 0.7 : 1 }}
      >
        {saving ? 'Saving…' : saved ? 'Saved! ✅' : 'Save Changes'}
      </button>
    </div>
  )
}
