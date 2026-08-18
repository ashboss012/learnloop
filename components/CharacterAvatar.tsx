export type NinjaPose = 'ready' | 'action' | 'throw' | 'sneak'

export interface CharacterDesign {
  shape: 'ninja' | 'vehicle'
  color: string
  accent: string
  pose?: NinjaPose
}

interface Props {
  design: CharacterDesign
  size?: number
  locked?: boolean
}

// Extends components/Mascot.tsx's parametric-SVG pattern (props/CSS-var
// driven, not image assets) to a wider roster. Ninja bodies share the same
// head + torso across every character - only the arm/leg paths change per
// `pose`, so 4 templates cover the whole roster without needing bespoke
// art per character. `locked` renders a muted silhouette with a lock badge.
export default function CharacterAvatar({ design, size = 72, locked = false }: Props) {
  const color = locked ? 'var(--border)' : design.color
  const accent = locked ? 'var(--muted)' : design.accent
  const pose = design.pose ?? 'ready'

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
            {/* Limbs render behind the torso so shoulders/hips look attached */}
            <NinjaLimbs pose={pose} color={color} />

            {/* Torso */}
            <path d="M37 36 L63 36 L59 63 L41 63 Z" fill={color} />

            {/* Head */}
            <circle cx="50" cy="24" r="13" fill={color} />
            <circle cx="45" cy="23" r="2.6" fill="white" />
            <circle cx="55" cy="23" r="2.6" fill="white" />
            <circle cx="45" cy="23" r="1.3" fill="var(--text)" />
            <circle cx="55" cy="23" r="1.3" fill="var(--text)" />
            <path d="M45 29 Q50 32 55 29" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />

            {/* Headband */}
            <path d="M36 18 Q50 10 64 18 L64 22 Q50 15 36 22 Z" fill={accent} />
            <path d="M61 19 L74 15 L72 22 Z" fill={accent} />
            <path d="M61 22 L74 24 L70 29 Z" fill={accent} />
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

function NinjaLimbs({ pose, color }: { pose: NinjaPose; color: string }) {
  switch (pose) {
    case 'action':
      // One leg planted, one kicking forward; arms thrown out to the sides.
      return (
        <>
          <rect x="38" y="61" width="8" height="23" rx="3" fill={color} />
          <rect x="53" y="60" width="8" height="22" rx="3" fill={color} transform="rotate(38 57 62)" />
          <rect x="20" y="39" width="20" height="7" rx="3" fill={color} transform="rotate(-22 30 43)" />
          <rect x="60" y="39" width="20" height="7" rx="3" fill={color} transform="rotate(22 70 43)" />
        </>
      )
    case 'throw':
      // Back leg staggered; one arm cocked back overhead for the throw.
      return (
        <>
          <rect x="39" y="61" width="8" height="23" rx="3" fill={color} />
          <rect x="52" y="61" width="8" height="23" rx="3" fill={color} transform="rotate(12 56 62)" />
          <rect x="61" y="16" width="7" height="23" rx="3" fill={color} transform="rotate(-32 65 20)" />
          <rect x="24" y="41" width="18" height="7" rx="3" fill={color} transform="rotate(-8 33 44)" />
        </>
      )
    case 'sneak':
      // Crouched: shorter bent legs, both arms low and forward.
      return (
        <>
          <rect x="40" y="60" width="7" height="17" rx="3" fill={color} transform="rotate(-6 43 68)" />
          <rect x="53" y="60" width="7" height="17" rx="3" fill={color} transform="rotate(6 56 68)" />
          <rect x="28" y="51" width="18" height="7" rx="3" fill={color} transform="rotate(8 37 54)" />
          <rect x="54" y="51" width="18" height="7" rx="3" fill={color} transform="rotate(-8 63 54)" />
        </>
      )
    case 'ready':
    default:
      // Standing straight, arms crossed over the chest.
      return (
        <>
          <rect x="40" y="62" width="8" height="24" rx="3" fill={color} />
          <rect x="52" y="62" width="8" height="24" rx="3" fill={color} />
          <rect x="40" y="44" width="20" height="6" rx="3" fill={color} transform="rotate(14 50 47)" />
          <rect x="40" y="44" width="20" height="6" rx="3" fill={color} transform="rotate(-14 50 47)" />
        </>
      )
  }
}
