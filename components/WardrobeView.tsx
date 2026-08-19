'use client'

import { useState, useEffect } from 'react'
import { getWardrobeState, openDailyChest, buyItem, equipItem, type WardrobeItem } from '@/app/actions/wardrobe'
import AvatarView, { type EquippedWardrobe } from '@/components/AvatarView'

interface State {
  items: WardrobeItem[]
  coins: number
  equipped: EquippedWardrobe
  chestAvailable: boolean
}

interface RevealedItem { id: string; slot: string; name: string; rarity: string; design: Record<string, unknown> }
type RevealResult = { fullCollection: true; coinsEarned: number } | { fullCollection: false; item: RevealedItem }

const SLOT_LABELS: Record<WardrobeItem['slot'], string> = { shirt: 'Shirts', pants: 'Pants', accessory: 'Accessories' }
const RARITY_COLORS: Record<string, string> = { common: 'var(--muted)', rare: 'var(--freeze)', epic: 'var(--primary)', legendary: '#ca8a04' }
const SLOTS: WardrobeItem['slot'][] = ['shirt', 'pants', 'accessory']

function ItemSwatch({ slot, design, size = 40 }: { slot: string; design: Record<string, unknown>; size?: number }) {
  const color = typeof design.color === 'string' ? design.color : 'var(--muted)'
  if (slot === 'accessory') {
    return (
      <div
        className="flex items-center justify-center rounded-2xl"
        style={{ width: size, height: size, background: color, fontSize: size * 0.5 }}
      >
        {design.kind === 'glasses' ? '🕶️' : '🎩'}
      </div>
    )
  }
  return <div className="rounded-xl" style={{ width: size, height: size, background: color }} />
}

export default function WardrobeView() {
  const [state, setState] = useState<State | null>(null)
  const [opening, setOpening] = useState(false)
  const [busyItemId, setBusyItemId] = useState<string | null>(null)
  const [reveal, setReveal] = useState<RevealResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    const res = await getWardrobeState()
    if (!('error' in res)) setState(res)
  }

  useEffect(() => {
    let cancelled = false
    getWardrobeState().then(res => {
      if (!cancelled && !('error' in res)) setState(res)
    })
    return () => { cancelled = true }
  }, [])

  async function handleOpenChest() {
    if (opening || !state?.chestAvailable) return
    setOpening(true)
    setError(null)
    const res = await openDailyChest()
    setOpening(false)
    if ('error' in res) { setError(res.error ?? 'Something went wrong'); return }
    setReveal(res)
    await refresh()

    import('canvas-confetti').then(({ default: confetti }) => {
      confetti({ particleCount: 130, spread: 100, origin: { y: 0.5 }, colors: ['#6c63ff', '#f59e0b', '#22c55e'] })
    })
  }

  async function handleBuy(itemId: string) {
    if (busyItemId) return
    setBusyItemId(itemId)
    setError(null)
    const res = await buyItem(itemId)
    setBusyItemId(null)
    if ('error' in res) { setError(res.error ?? 'Something went wrong'); return }
    await refresh()
  }

  async function handleEquip(itemId: string) {
    if (busyItemId) return
    setBusyItemId(itemId)
    setError(null)
    const res = await equipItem(itemId)
    setBusyItemId(null)
    if ('error' in res) { setError(res.error ?? 'Something went wrong'); return }
    await refresh()
  }

  if (!state) {
    return <p className="text-center font-semibold py-10" style={{ color: 'var(--muted)' }}>Loading…</p>
  }

  return (
    <div>
      <div className="flex flex-col items-center mb-6">
        <AvatarView equipped={state.equipped} size={140} />
        <span
          className="font-black rounded-full px-4 py-1.5 mt-2"
          style={{ background: 'color-mix(in srgb, var(--xp) 18%, var(--surface))', color: '#ca8a04' }}
        >
          🪙 {state.coins} coins
        </span>
      </div>

      <div className="rounded-3xl p-5 mb-6" style={{ background: 'var(--surface)', border: '2px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="font-bold text-sm" style={{ color: 'var(--muted)' }}>
            {state.chestAvailable ? 'Daily chest ready!' : 'Practice 30 min today to unlock'}
          </span>
        </div>
        <button
          onClick={handleOpenChest}
          disabled={!state.chestAvailable || opening}
          className="btn-3d w-full rounded-2xl font-black text-white"
          style={{
            background: state.chestAvailable ? 'var(--xp)' : 'var(--border)',
            borderTopColor: state.chestAvailable ? 'var(--xp)' : 'var(--border)',
            borderLeftColor: state.chestAvailable ? 'var(--xp)' : 'var(--border)',
            borderRightColor: state.chestAvailable ? 'var(--xp)' : 'var(--border)',
            borderBottomColor: state.chestAvailable ? 'color-mix(in srgb, var(--xp) 70%, black)' : 'var(--border)',
            fontSize: '1.1rem',
            padding: '14px 20px',
            minHeight: 56,
            opacity: state.chestAvailable ? 1 : 0.6,
          }}
        >
          {opening ? 'Opening…' : state.chestAvailable ? '🎁 Open Daily Chest' : '🎁 Locked'}
        </button>
      </div>

      {error && <p className="text-sm font-bold mb-4 text-center" style={{ color: 'var(--wrong)' }}>{error}</p>}

      {SLOTS.map(slot => (
        <div key={slot} className="mb-6">
          <h2 className="font-black text-lg mb-3">{SLOT_LABELS[slot]}</h2>
          <div className="grid grid-cols-3 gap-4">
            {state.items.filter(i => i.slot === slot).map(item => (
              <div key={item.id} className="flex flex-col items-center gap-1.5">
                <div
                  className="rounded-2xl flex items-center justify-center"
                  style={{ width: 64, height: 64, background: 'var(--surface-alt)', border: `2px solid ${item.equipped ? 'var(--primary)' : 'var(--border)'}` }}
                >
                  <ItemSwatch slot={item.slot} design={item.design} />
                </div>
                <span className="font-black text-center" style={{ fontSize: '0.65rem', color: RARITY_COLORS[item.rarity] }}>{item.name}</span>
                {item.equipped ? (
                  <span className="font-bold" style={{ fontSize: '0.65rem', color: 'var(--primary)' }}>Equipped</span>
                ) : item.owned ? (
                  <button
                    onClick={() => handleEquip(item.id)}
                    disabled={busyItemId === item.id}
                    className="rounded-full font-black"
                    style={{ fontSize: '0.65rem', padding: '4px 10px', background: 'var(--primary)', color: 'white' }}
                  >
                    Equip
                  </button>
                ) : (
                  <button
                    onClick={() => handleBuy(item.id)}
                    disabled={busyItemId === item.id || state.coins < item.coinPrice}
                    className="rounded-full font-black"
                    style={{
                      fontSize: '0.65rem',
                      padding: '4px 10px',
                      background: state.coins < item.coinPrice ? 'var(--border)' : 'var(--xp)',
                      color: 'white',
                      opacity: state.coins < item.coinPrice ? 0.7 : 1,
                    }}
                  >
                    🪙{item.coinPrice}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {reveal && (
        <div
          className="fixed inset-0 z-40 flex flex-col items-center justify-center px-5 text-center safe-bottom"
          style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
        >
          {reveal.fullCollection ? (
            <>
              <span style={{ fontSize: 64 }}>🏆</span>
              <h1 className="font-black text-white mt-3 mb-2" style={{ fontSize: 'clamp(1.5rem, 6vw, 2rem)' }}>
                Full wardrobe!
              </h1>
              <p className="font-semibold mb-8" style={{ color: '#c4b5fd' }}>
                You already have everything here — +{reveal.coinsEarned} coins instead!
              </p>
            </>
          ) : (
            <>
              <div className="mb-3 rounded-3xl p-5" style={{ background: 'rgba(255,255,255,0.12)' }}>
                <ItemSwatch slot={reveal.item.slot} design={reveal.item.design} size={100} />
              </div>
              <span
                className="font-black rounded-full px-4 py-1.5 mb-3 inline-block"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#fef3c7', fontSize: '0.9rem' }}
              >
                New item!
              </span>
              <h1 className="font-black text-white mb-2" style={{ fontSize: 'clamp(1.75rem, 7vw, 2.25rem)' }}>
                {reveal.item.name}
              </h1>
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
    </div>
  )
}
