interface Props {
  mood?: 'happy' | 'excited'
  size?: number
}

export default function Mascot({ mood = 'happy', size = 56 }: Props) {
  const excited = mood === 'excited'
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="55" rx="38" ry="34" fill="var(--primary)" />
      <circle cx="37" cy="48" r="6" fill="white" />
      <circle cx="63" cy="48" r="6" fill="white" />
      <circle cx="37" cy="48" r="3" fill="var(--text)" />
      <circle cx="63" cy="48" r="3" fill="var(--text)" />
      {excited ? (
        <path d="M35 65 Q50 80 65 65" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M38 66 Q50 74 62 66" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" />
      )}
      {excited && (
        <>
          <path d="M20 30 L26 20" stroke="var(--xp)" strokeWidth="3" strokeLinecap="round" />
          <path d="M80 30 L74 20" stroke="var(--xp)" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}
