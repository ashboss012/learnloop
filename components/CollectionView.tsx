'use client'

import { useState } from 'react'
import { getCollectionState, selectSeason, openChest, type CollectionCharacter, type CustomCharacter } from '@/app/actions/characters'
import CharacterAvatar from '@/components/CharacterAvatar'
import CharacterCustomizer from '@/components/CharacterCustomizer'
import WardrobeView from '@/components/WardrobeView'

interface Season { slug: string; name: string; icon: string }

interface State {
  seasons: Season[]
  activeSeason: string | null
  characters: CollectionCharacter[]
  customCharacters: CustomCharacter[]
  chestsAvailable: number
  secondsToNextChest: number
  secondsPerChest: number
}

interface RevealResult {
  fullCollection: boolean
  character?: Omit<CollectionCharacter, 'owned'>
  xpEarned?: number
}

export default function CollectionView({ initial }: { initial: State }) {
  const [state, setState] = useState<State>(initial)
  const [switching, setSwitching] = useState(false)
  const [opening, setOpening] = useState(false)
  const [reveal, setReveal] = useState<RevealResult | null>(null)
  const [customizing, setCustomizing] = useState(false)
  const [view, setView] = useState<'characters' | 'avatar'>('characters')

  async function refresh() {
    const next = await getCollectionState()
    if (!('error' in next)) setState(next)
  }

  async function handleSelectSeason(slug: string) {
    if (slug === state.activeSeason || switching) return
    setSwitching(true)
    await selectSeason(slug)
    await refresh()
    setSwitching(false)
  }

  async function handleOpenChest() {
    if (opening || state.chestsAvailable <= 0) return
    setOpening(true)
    const result = await openChest()
    setOpening(false)
    if ('error' in result) return
    setReveal(result)
    await refresh()

    import('canvas-confetti').then(({ default: confetti }) => {
      confetti({ particleCount: 130, spread: 100, origin: { y: 0.5 }, colors: ['#6c63ff', '#f59e0b', '#22c55e'] })
    })
  }

  const minutesToNext = Math.ceil(state.secondsToNextChest / 60)
  const minutesPerChest = Math.round(state.secondsPerChest / 60)
  const progressPct = Math.round(((state.secondsPerChest - state.secondsToNextChest) / state.secondsPerChest) * 100)

  return (
    <div className="max-w-lg mx-auto px-4 py-8 page-enter">
      <div className="mb-6">
        <h1 className="text-3xl font-black mb-1 tracking-tight">Collection 🎁</h1>
        <p className="text-gray-500 font-semibold">Learn to earn chests. Open them to collect characters.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-6 rounded-2xl p-1" style={{ background: 'var(--surface-alt)' }}>
        {(['characters', 'avatar'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="rounded-xl font-black py-2"
            style={{
              background: view === v ? 'var(--surface)' : 'transparent',
              color: view === v ? 'var(--text)' : 'var(--muted)',
              boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              fontSize: '0.9rem',
            }}
          >
            {v === 'characters' ? 'Characters' : 'Avatar'}
          </button>
        ))}
      </div>

      {view === 'avatar' ? (
        <WardrobeView />
      ) : (
        <>
          <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
            {state.seasons.map(season => {
              const active = season.slug === state.activeSeason
              return (
                <button
                  key={season.slug}
                  onClick={() => handleSelectSeason(season.slug)}
                  disabled={switching}
                  className="rounded-2xl font-black shrink-0"
                  style={{
                    padding: '10px 16px',
                    background: active ? 'var(--primary)' : 'var(--surface)',
                    color: active ? 'white' : 'var(--text)',
                    border: `2px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                    fontSize: '0.9rem',
                  }}
                >
                  {season.icon} {season.name}
                </button>
              )
            })}
          </div>

          <div className="rounded-3xl p-5 mb-6" style={{ background: 'var(--surface)', border: '2px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm" style={{ color: 'var(--muted)' }}>
                {state.chestsAvailable > 0 ? `${state.chestsAvailable} chest${state.chestsAvailable > 1 ? 's' : ''} ready!` : `${minutesToNext} min to next chest`}
              </span>
              <span className="font-bold text-sm" style={{ color: 'var(--muted)' }}>{minutesPerChest} min / chest</span>
            </div>
            <div className="bg-gray-200 rounded-full overflow-hidden mb-4" style={{ height: 10 }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${state.chestsAvailable > 0 ? 100 : progressPct}%`, background: 'var(--xp)' }}
              />
            </div>
            <button
              onClick={handleOpenChest}
              disabled={state.chestsAvailable <= 0 || opening}
              className="btn-3d w-full rounded-2xl font-black text-white"
              style={{
                background: state.chestsAvailable > 0 ? 'var(--xp)' : 'var(--border)',
                borderTopColor: state.chestsAvailable > 0 ? 'var(--xp)' : 'var(--border)',
                borderLeftColor: state.chestsAvailable > 0 ? 'var(--xp)' : 'var(--border)',
                borderRightColor: state.chestsAvailable > 0 ? 'var(--xp)' : 'var(--border)',
                borderBottomColor: state.chestsAvailable > 0 ? 'color-mix(in srgb, var(--xp) 70%, black)' : 'var(--border)',
                fontSize: '1.1rem',
                padding: '14px 20px',
                minHeight: 56,
                opacity: state.chestsAvailable > 0 ? 1 : 0.6,
              }}
            >
              {opening ? 'Opening…' : state.chestsAvailable > 0 ? `🎁 Open Chest (${state.chestsAvailable})` : '🎁 Locked'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {state.characters.map(c => (
              <div key={c.id} className="flex flex-col items-center gap-1.5">
                <CharacterAvatar design={c.design} size={72} locked={!c.owned} />
                <span className="font-black text-center" style={{ fontSize: '0.7rem', color: 'var(--text)' }}>
                  {c.owned ? c.name : '???'}
                </span>
              </div>
            ))}
            {state.characters.length === 0 && (
              <p className="col-span-3 text-center font-semibold py-8" style={{ color: 'var(--muted)' }}>
                This season is coming soon!
              </p>
            )}
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-black text-lg">Your Creations</h2>
              <button
                onClick={() => setCustomizing(true)}
                className="rounded-2xl font-black shrink-0"
                style={{ padding: '8px 14px', background: 'var(--primary)', color: 'white', fontSize: '0.85rem' }}
              >
                + Create Character
              </button>
            </div>
            {state.customCharacters.length > 0 ? (
              <div className="grid grid-cols-3 gap-4">
                {state.customCharacters.map(c => (
                  <div key={c.id} className="flex flex-col items-center gap-1.5">
                    <CharacterAvatar design={c.design} size={72} />
                    <span className="font-black text-center" style={{ fontSize: '0.7rem', color: 'var(--text)' }}>{c.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center font-semibold py-6 rounded-3xl" style={{ color: 'var(--muted)', background: 'var(--surface)', border: '2px solid var(--border)' }}>
                No creations yet — make your own ninja!
              </p>
            )}
          </div>

          {customizing && (
            <CharacterCustomizer
              onClose={() => setCustomizing(false)}
              onCreated={created => setState(prev => ({ ...prev, customCharacters: [...prev.customCharacters, created] }))}
            />
          )}

          {reveal && (
            <div
              className="fixed inset-0 z-40 flex flex-col items-center justify-center px-5 text-center safe-bottom"
              style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
            >
              {reveal.fullCollection ? (
                <>
                  <span style={{ fontSize: 64 }}>🏆</span>
                  <h1 className="font-black text-white mt-3 mb-2" style={{ fontSize: 'clamp(1.5rem, 6vw, 2rem)' }}>
                    Full collection!
                  </h1>
                  <p className="font-semibold mb-8" style={{ color: '#c4b5fd' }}>
                    You already have everyone here — +{reveal.xpEarned} XP instead!
                  </p>
                </>
              ) : (
                <>
                  <div className="mb-3">
                    <CharacterAvatar design={reveal.character!.design} size={140} />
                  </div>
                  <span
                    className="font-black rounded-full px-4 py-1.5 mb-3 inline-block"
                    style={{ background: 'rgba(255,255,255,0.15)', color: '#fef3c7', fontSize: '0.9rem' }}
                  >
                    New character!
                  </span>
                  <h1 className="font-black text-white mb-2" style={{ fontSize: 'clamp(1.75rem, 7vw, 2.25rem)' }}>
                    {reveal.character!.name}
                  </h1>
                  <p className="font-semibold mb-8 max-w-xs" style={{ color: '#c4b5fd' }}>
                    {reveal.character!.flavorText}
                  </p>
                </>
              )}
              <button
                onClick={() => setReveal(null)}
                className="btn-3d w-full bg-white rounded-2xl font-black"
                style={{
                  maxWidth: 360,
                  color: 'var(--primary)',
                  borderTopColor: 'white',
                  borderLeftColor: 'white',
                  borderRightColor: 'white',
                  borderBottomColor: 'color-mix(in srgb, var(--primary) 30%, white)',
                  fontSize: '1.1rem',
                  padding: '16px 24px',
                  minHeight: 56,
                }}
              >
                Nice! 🎉
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
