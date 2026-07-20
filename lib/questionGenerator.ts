import { generateQuestion as generateMathQuestion } from '@/lib/math/generator'
import { generateQuestion as generateEnglishQuestion } from '@/lib/english/generator'
import type { GeneratedQuestion } from '@/types'

// Routes by slug prefix, not a DB lookup - every skill slug is already
// consistently prefixed with its subject (math-*, english-*).
export function generateQuestion(slug: string, tier: number): GeneratedQuestion {
  return slug.startsWith('english-') ? generateEnglishQuestion(slug, tier) : generateMathQuestion(slug, tier)
}
