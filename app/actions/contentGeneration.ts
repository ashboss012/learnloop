'use server'

import { createClient } from '@/lib/supabase/server'
import { fleschKincaidGradeLevel, inReadingLevelBand, READING_LEVEL_BAND } from '@/lib/readability'
import { revalidatePath } from 'next/cache'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent'
const READING_SKILL_SLUG = 'english-reading-comprehension'

const QUESTION_KINDS = ['main_idea', 'detail', 'vocabulary', 'inference'] as const
type QuestionKind = typeof QUESTION_KINDS[number]

interface GeneratedQuestionDraft {
  kind: QuestionKind
  prompt: string
  choices: string[]
  answer: string
  explanation: string
}
interface GeneratedPassageDraft {
  topic?: string
  passage: string
  questions: GeneratedQuestionDraft[]
}

// Without a concrete seed the model gravitates to the same 2-3 topics
// (dog training, cardboard forts) across separate calls. Picking one at
// random per call and asking for that specific scenario forces real variety
// - still "a topic a 4th grader would enjoy," just not always the same one.
const TOPIC_SEEDS = [
  'a kid learning to skateboard for the first time',
  'two siblings baking cookies and a mistake with the recipe',
  'a class field trip to a farm',
  'a kid starting at a new school and making a friend',
  'a family camping trip and a surprise rainstorm',
  'a kid saving up allowance to buy something special',
  'a neighborhood kickball game',
  'a kid taking care of a lost cat until its owner is found',
  'a sibling rivalry over a board game',
  'a kid overcoming stage fright before a school talent show',
  'a rainy day indoor scavenger hunt',
  'a kid learning to ride a bike without training wheels',
  'a class project building a model volcano',
  'a kid running a lemonade stand for the first time',
  'a family road trip and a fun car game',
  'a kid teaching a younger sibling how to swim',
]

function buildPrompt(topicSeed: string): string {
  return `You are writing reading material for a 4th-grade student (age 9-10).

Write one original, kid-friendly passage (150-250 words) about: ${topicSeed}. Keep it concrete and everyday, like something in a beginning chapter book. Avoid heavy science or nature-documentary topics - they tend to pull in advanced vocabulary.

Write it at an actual 4th-grade reading level, not just a 4th-grade topic: short sentences (aim for 8-12 words each), everyday words a 9-year-old already knows, and no more than one or two slightly harder vocabulary words in the whole passage (those can become the vocabulary question). Do not reuse or closely paraphrase any existing copyrighted text - write something new.

Then write exactly 4 comprehension questions grounded ONLY in that passage, one of each kind: "main_idea", "detail", "vocabulary", "inference". Each question needs exactly 4 answer choices, one correct answer (must exactly match one of the choices, character for character), and a one-sentence explanation of why that answer is correct.

Return ONLY valid JSON, no markdown, no commentary, in exactly this shape:
{
  "topic": "short topic label",
  "passage": "the full passage text",
  "questions": [
    { "kind": "main_idea", "prompt": "...", "choices": ["...", "...", "...", "..."], "answer": "...", "explanation": "..." },
    { "kind": "detail", "prompt": "...", "choices": ["...", "...", "...", "..."], "answer": "...", "explanation": "..." },
    { "kind": "vocabulary", "prompt": "...", "choices": ["...", "...", "...", "..."], "answer": "...", "explanation": "..." },
    { "kind": "inference", "prompt": "...", "choices": ["...", "...", "...", "..."], "answer": "...", "explanation": "..." }
  ]
}`
}

async function callGemini(): Promise<GeneratedPassageDraft | null> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null

  const topicSeed = TOPIC_SEEDS[Math.floor(Math.random() * TOPIC_SEEDS.length)]

  try {
    const res = await fetch(`${GEMINI_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(topicSeed) }] }],
        // maxOutputTokens has generous headroom - this model spends some of
        // its own budget on hidden "thinking" tokens before the visible
        // JSON response, on top of the ~800-1200 the passage+questions need.
        generationConfig: { maxOutputTokens: 4096, temperature: 0.8 },
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return null

    const data = await res.json() as { candidates?: { content: { parts: { text: string }[] } }[] }
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    return JSON.parse(jsonStr) as GeneratedPassageDraft
  } catch {
    return null
  }
}

// All-or-nothing - never coerce a malformed shape into something insertable.
function isValidDraft(draft: GeneratedPassageDraft | null): draft is GeneratedPassageDraft {
  if (!draft) return false
  if (typeof draft.passage !== 'string' || draft.passage.trim().length < 50) return false
  if (!Array.isArray(draft.questions) || draft.questions.length !== 4) return false

  const kinds = new Set(draft.questions.map(q => q.kind))
  if (kinds.size !== 4 || !QUESTION_KINDS.every(k => kinds.has(k))) return false

  return draft.questions.every(q => {
    if (typeof q.prompt !== 'string' || !q.prompt.trim()) return false
    if (!Array.isArray(q.choices) || q.choices.length !== 4) return false
    if (q.choices.some(c => typeof c !== 'string' || !c.trim())) return false
    if (typeof q.answer !== 'string' || !q.answer.trim()) return false
    if (typeof q.explanation !== 'string' || !q.explanation.trim()) return false
    // Same case-insensitive comparison gradeAnswer already uses.
    return q.choices.some(c => c.trim().toLowerCase() === q.answer.trim().toLowerCase())
  })
}

interface BatchSummary {
  inserted: number
  pending: number
  rejectedByReadability: number
  failed: number
}

export async function generateReadingBatch(count: number): Promise<BatchSummary | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Forbidden' }

  const { data: skill } = await supabase.from('skills').select('id, subject').eq('slug', READING_SKILL_SLUG).single()
  if (!skill) return { error: 'Reading comprehension skill not found' }

  const clampedCount = Math.min(3, Math.max(1, count))
  const summary: BatchSummary = { inserted: 0, pending: 0, rejectedByReadability: 0, failed: 0 }

  for (let i = 0; i < clampedCount; i++) {
    const draft = await callGemini()
    if (!isValidDraft(draft)) { summary.failed++; continue }

    const readingLevel = fleschKincaidGradeLevel(draft.passage)
    const inBand = inReadingLevelBand(readingLevel)
    const status = inBand ? 'pending' : 'rejected'
    const rejectionReason = inBand
      ? null
      : `readability ${readingLevel.toFixed(1)} outside ${READING_LEVEL_BAND[0]}-${READING_LEVEL_BAND[1]}`

    const { data: passageRow, error: passageErr } = await supabase
      .from('passages')
      .insert({
        skill_id: skill.id,
        topic: draft.topic ?? null,
        text: draft.passage,
        reading_level: readingLevel,
        status,
        rejection_reason: rejectionReason,
      })
      .select()
      .single()
    if (passageErr || !passageRow) { summary.failed++; continue }

    const questionRows = draft.questions.map(q => ({
      skill_id: skill.id,
      subject: skill.subject,
      passage_id: passageRow.id,
      question_kind: q.kind,
      prompt: q.prompt,
      choices: q.choices.map(c => ({ label: c, value: c })),
      answer: q.answer,
      explanation: q.explanation,
      status,
    }))
    const { error: qErr } = await supabase.from('questions').insert(questionRows)
    if (qErr) {
      // Compensating rollback - no multi-table transaction available here.
      await supabase.from('passages').delete().eq('id', passageRow.id)
      summary.failed++
      continue
    }

    summary.inserted++
    if (status === 'pending') summary.pending++
    else summary.rejectedByReadability++
  }

  revalidatePath('/admin/review')
  return summary
}
