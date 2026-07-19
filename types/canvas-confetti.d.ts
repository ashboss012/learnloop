declare module 'canvas-confetti' {
  export interface Options {
    particleCount?: number
    spread?: number
    origin?: { x?: number; y?: number }
    colors?: string[]
  }
  type ConfettiFn = (options?: Options) => Promise<null> | null
  const confetti: ConfettiFn
  export default confetti
}
