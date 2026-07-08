'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) { setError(error.message); return }
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { display_name: displayName || email.split('@')[0] } },
        })
        if (error) { setError(error.message); return }
      }
      router.push('/dashboard')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🧠</div>
          <h1 className="text-3xl font-black" style={{ color: 'var(--primary)' }}>LearnLoop</h1>
          <p className="text-gray-500 mt-1 font-semibold">Math practice, your way</p>
        </div>

        <div className="flex rounded-2xl bg-gray-100 p-1 mb-6">
          {(['login', 'signup'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="flex-1 py-2 rounded-xl font-bold text-sm transition-all"
              style={mode === m ? { background: 'var(--primary)', color: 'white' } : { color: 'var(--muted)' }}
            >
              {m === 'login' ? 'Log In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="Your name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full border-2 rounded-2xl px-4 py-3 font-semibold text-base outline-none focus:border-purple-400 transition-colors"
              style={{ borderColor: 'var(--border)' }}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full border-2 rounded-2xl px-4 py-3 font-semibold text-base outline-none focus:border-purple-400 transition-colors"
            style={{ borderColor: 'var(--border)' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full border-2 rounded-2xl px-4 py-3 font-semibold text-base outline-none focus:border-purple-400 transition-colors"
            style={{ borderColor: 'var(--border)' }}
          />
          {error && <p className="text-red-500 text-sm font-semibold">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-2xl font-black text-lg text-white transition-all active:scale-95"
            style={{ background: loading ? 'var(--muted)' : 'var(--primary)' }}
          >
            {loading ? '...' : mode === 'login' ? 'Let\'s Go! 🚀' : 'Start Learning! 🎉'}
          </button>
        </form>
      </div>
    </div>
  )
}
