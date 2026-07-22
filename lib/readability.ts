// Flesch-Kincaid grade level, pure JS - a heuristic sanity check on
// generated passages before they ever reach the review queue (docs/03:
// "do not trust the model's self-assessment of difficulty").
export function fleschKincaidGradeLevel(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean)
  if (words.length === 0 || sentences.length === 0) return 0

  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0)
  return 0.39 * (words.length / sentences.length) + 11.8 * (syllables / words.length) - 15.59
}

function countSyllables(rawWord: string): number {
  const word = rawWord.toLowerCase().replace(/[^a-z]/g, '')
  if (word.length <= 3) return 1
  const trimmed = word.replace(/(?:[^aeiouy]es|ed|[^aeiouy]e)$/, '').replace(/^y/, '')
  const groups = trimmed.match(/[aeiouy]{1,2}/g)
  return Math.max(1, groups ? groups.length : 1)
}

// Target: 4th grade, with slack either side rather than an exact match.
export const READING_LEVEL_BAND: [number, number] = [3.0, 5.5]

export function inReadingLevelBand(score: number): boolean {
  return score >= READING_LEVEL_BAND[0] && score <= READING_LEVEL_BAND[1]
}
