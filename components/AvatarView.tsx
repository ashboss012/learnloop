export interface ShirtDesign { color: string; accent?: string; pattern?: 'stripe' }
export interface PantsDesign { color: string; accent?: string; pattern?: 'stripe' }
export interface AccessoryDesign { kind: 'hat' | 'glasses'; color: string }

export interface EquippedWardrobe {
  shirt?: ShirtDesign
  pants?: PantsDesign
  accessory?: AccessoryDesign
}

interface Props {
  equipped: EquippedWardrobe
  size?: number
}

const SKIN = '#f4c28f'
const DEFAULT_SHIRT = '#e5e7eb'
const DEFAULT_PANTS = '#9ca3af'
const SHOE = '#27272a'

// Roblox-style blocky humanoid: rectangular head/torso/limbs (distinct from
// CharacterAvatar.tsx's rounded ninja shapes). Shirt/pants/accessory are
// layers drawn over a fixed base body using each equipped item's simple
// color/pattern design params - same parametric-SVG trust model as
// CharacterAvatar.tsx, just a different silhouette.
export default function AvatarView({ equipped, size = 96 }: Props) {
  const shirtColor = equipped.shirt?.color ?? DEFAULT_SHIRT
  const pantsColor = equipped.pants?.color ?? DEFAULT_PANTS

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {/* Legs */}
      <rect x="32" y="68" width="15" height="26" rx="4" fill={pantsColor} />
      <rect x="53" y="68" width="15" height="26" rx="4" fill={pantsColor} />
      {equipped.pants?.pattern === 'stripe' && (
        <>
          <rect x="32" y="78" width="15" height="5" fill={equipped.pants.accent ?? '#ffffff'} />
          <rect x="53" y="78" width="15" height="5" fill={equipped.pants.accent ?? '#ffffff'} />
        </>
      )}
      <rect x="31" y="90" width="17" height="6" rx="2" fill={SHOE} />
      <rect x="52" y="90" width="17" height="6" rx="2" fill={SHOE} />

      {/* Arms */}
      <rect x="15" y="38" width="14" height="30" rx="5" fill={shirtColor} />
      <rect x="71" y="38" width="14" height="30" rx="5" fill={shirtColor} />
      <circle cx="22" cy="70" r="6" fill={SKIN} />
      <circle cx="78" cy="70" r="6" fill={SKIN} />

      {/* Torso */}
      <rect x="29" y="36" width="42" height="34" rx="6" fill={shirtColor} />
      {equipped.shirt?.pattern === 'stripe' && (
        <rect x="29" y="49" width="42" height="8" fill={equipped.shirt.accent ?? '#ffffff'} />
      )}

      {/* Head */}
      <rect x="34" y="8" width="32" height="28" rx="6" fill={SKIN} />
      <circle cx="43" cy="22" r="2.6" fill="var(--text)" />
      <circle cx="57" cy="22" r="2.6" fill="var(--text)" />
      <path d="M43 29 Q50 33 57 29" stroke="var(--text)" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* Accessory */}
      {equipped.accessory?.kind === 'hat' && (
        <>
          <rect x="32" y="4" width="36" height="9" rx="3" fill={equipped.accessory.color} />
          <rect x="32" y="11" width="36" height="4" fill={equipped.accessory.color} />
        </>
      )}
      {equipped.accessory?.kind === 'glasses' && (
        <>
          <rect x="39" y="19" width="8" height="6" rx="2" fill="none" stroke={equipped.accessory.color} strokeWidth="2.5" />
          <rect x="53" y="19" width="8" height="6" rx="2" fill="none" stroke={equipped.accessory.color} strokeWidth="2.5" />
          <line x1="47" y1="22" x2="53" y2="22" stroke={equipped.accessory.color} strokeWidth="2.5" />
        </>
      )}
    </svg>
  )
}
