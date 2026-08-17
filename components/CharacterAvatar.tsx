export interface CharacterDesign {
  shape: 'ninja' | 'vehicle'
  color: string
  accent: string
}

interface Props {
  design: CharacterDesign
  size?: number
  locked?: boolean
}

// Extends components/Mascot.tsx's parametric-SVG pattern (blob body, eyes,
// mouth, all driven by props/CSS vars) to a wider roster instead of one
// fixed mascot. `locked` renders a muted silhouette with a lock badge -
// same character shape, no real color, so a not-yet-owned character still
// teases its outline in the collection grid.
export default function CharacterAvatar({ design, size = 72, locked = false }: Props) {
  const color = locked ? 'var(--border)' : design.color
  const accent = locked ? 'var(--muted)' : design.accent

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        {design.shape === 'vehicle' ? (
          <>
            <rect x="14" y="42" width="72" height="26" rx="10" fill={color} />
            <rect x="28" y="30" width="44" height="20" rx="8" fill={color} />
            <rect x="32" y="34" width="36" height="12" rx="4" fill={accent} />
            <circle cx="32" cy="70" r="10" fill="var(--text)" />
            <circle cx="68" cy="70" r="10" fill="var(--text)" />
            <circle cx="32" cy="70" r="4" fill={accent} />
            <circle cx="68" cy="70" r="4" fill={accent} />
            <circle cx="22" cy="52" r="4" fill="white" />
            <circle cx="78" cy="52" r="4" fill="white" />
          </>
        ) : (
          <>
            <ellipse cx="50" cy="55" rx="38" ry="34" fill={color} />
            <circle cx="37" cy="48" r="6" fill="white" />
            <circle cx="63" cy="48" r="6" fill="white" />
            <circle cx="37" cy="48" r="3" fill="var(--text)" />
            <circle cx="63" cy="48" r="3" fill="var(--text)" />
            <path d="M38 66 Q50 74 62 66" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" />
            {design.shape === 'ninja' && (
              <>
                <path d="M14 36 Q50 24 86 36 L86 42 Q50 32 14 42 Z" fill={accent} />
                <path d="M83 38 L96 34 L94 42 Z" fill={accent} />
                <path d="M83 42 L96 44 L92 50 Z" fill={accent} />
              </>
            )}
          </>
        )}
      </svg>
      {locked && (
        <span
          className="absolute inset-0 flex items-center justify-center"
          style={{ fontSize: size * 0.32 }}
        >
          🔒
        </span>
      )}
    </div>
  )
}
