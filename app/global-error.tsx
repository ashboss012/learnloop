'use client'

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html>
      <body style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', gap: 16 }}>
        <h2 style={{ fontSize: 24, fontWeight: 900 }}>Something went wrong</h2>
        <button onClick={reset} style={{ padding: '12px 24px', borderRadius: 16, background: '#6c63ff', color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
          Try again
        </button>
      </body>
    </html>
  )
}
