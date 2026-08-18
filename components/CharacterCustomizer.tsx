'use client'

import { useState } from 'react'
import CharacterAvatar, { type CharacterDesign, type NinjaPose } from '@/components/CharacterAvatar'
import { createCustomCharacter, type CustomCharacter } from '@/app/actions/characters'

// A bit wider than the seeded Ninja roster's strict blue/red/black rule -
// this is the student's own creative choice, so a curated-but-broader set
// feels right (still finite swatches, not a full color picker).
const COLORS = ['#0ea5e9', '#3b82f6', '#1e3a8a', '#dc2626', '#b91c1c', '#18181b', '#27272a', '#16a34a', '#9333ea', '#f97316']
const ACCENTS = ['#ffffff', '#1a1a2e', '#0ea5e9', '#dc2626', '#f59e0b']
const POSES: { value: NinjaPose; label: string }[] = [
  { value: 'ready', label: 'Ready' },
  { value: 'action', label: 'Action' },
  { value: 'throw', label: 'Throw' },
  { value: 'sneak', label: 'Sneak' },
]

interface Props {
  onClose: () => void
  onCreated: (character: CustomCharacter) => void
}

export default function CharacterCustomizer({ onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [accent, setAccent] = useState(ACCENTS[0])
  const [pose, setPose] = useState<NinjaPose>('ready')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const design: CharacterDesign = { shape: 'ninja', color, accent, pose }

  async function handleSave() {
    if (saving || !name.trim()) return
    setSaving(true)
    setError(null)
    const result = await createCustomCharacter(name, design)
    setSaving(false)
    if ('error' in result) { setError(result.error); return }
    onCreated(result.character)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col safe-bottom" style={{ background: 'var(--bg)' }}>
      <div className="flex items-center justify-between px-4 py-3 glass-bar border-b-2" style={{ borderColor: 'var(--border)' }}>
        <h2 className="font-black text-lg">Create Your Character</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex items-center justify-center rounded-full"
          style={{ width: 40, height: 40, fontSize: 20, color: 'var(--muted)' }}
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-lg mx-auto w-full">
        <div className="flex justify-center mb-6">
          <CharacterAvatar design={design} size={120} />
        </div>

        <label className="block mb-5">
          <span className="block font-black text-sm mb-1.5">Name</span>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={20}
            placeholder="What's their name?"
            className="w-full rounded-xl font-bold px-4"
            style={{ border: '2px solid var(--border)', minHeight: 48, fontSize: '1rem', background: 'var(--surface)', color: 'var(--text)' }}
          />
        </label>

        <div className="mb-5">
          <span className="block font-black text-sm mb-2">Color</span>
          <div className="flex flex-wrap gap-2">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                className="rounded-full"
                style={{ width: 40, height: 40, background: c, border: color === c ? '3px solid var(--text)' : '3px solid transparent' }}
              />
            ))}
          </div>
        </div>

        <div className="mb-5">
          <span className="block font-black text-sm mb-2">Headband color</span>
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map(a => (
              <button
                key={a}
                onClick={() => setAccent(a)}
                aria-label={`Accent ${a}`}
                className="rounded-full"
                style={{ width: 36, height: 36, background: a, border: accent === a ? '3px solid var(--primary)' : '2px solid var(--border)' }}
              />
            ))}
          </div>
        </div>

        <div className="mb-6">
          <span className="block font-black text-sm mb-2">Pose</span>
          <div className="grid grid-cols-4 gap-2">
            {POSES.map(p => {
              const active = pose === p.value
              return (
                <button
                  key={p.value}
                  onClick={() => setPose(p.value)}
                  className="rounded-2xl flex flex-col items-center gap-1 py-2"
                  style={{
                    background: active ? 'color-mix(in srgb, var(--primary) 15%, var(--surface))' : 'var(--surface)',
                    border: `2px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                  }}
                >
                  <CharacterAvatar design={{ shape: 'ninja', color: 'var(--muted)', accent: 'var(--muted)', pose: p.value }} size={44} />
                  <span className="font-bold" style={{ fontSize: '0.65rem' }}>{p.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {error && <p className="text-sm font-bold mb-3" style={{ color: 'var(--wrong)' }}>{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="btn-3d w-full rounded-2xl font-black text-white"
          style={{
            background: 'var(--primary)',
            borderTopColor: 'var(--primary)',
            borderLeftColor: 'var(--primary)',
            borderRightColor: 'var(--primary)',
            borderBottomColor: 'var(--primary-dark)',
            fontSize: '1.1rem',
            padding: '14px 20px',
            minHeight: 56,
            opacity: !name.trim() ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Create Character! 🎉'}
        </button>
      </div>
    </div>
  )
}
