import { describe, test, expect } from 'vitest'
import { generateQuestion } from '@/lib/english/generator'

// ── helpers ──────────────────────────────────────────────────────────────────

/** Run `fn` N times and collect results. */
function times<T>(n: number, fn: () => T): T[] {
  return Array.from({ length: n }, fn)
}

const SAMPLES = 500

function assertChoiceInvariants(q: ReturnType<typeof generateQuestion>, label: string) {
  const values = q.choices.map(c => c.value)
  expect(values.filter(v => v === q.answer).length, `${label}: answer appears != 1 time`).toBe(1)
  expect(new Set(values).size, `${label}: duplicate choices`).toBe(4)
  for (const v of values) {
    expect(v, `${label}: empty/undefined choice`).not.toBe('')
    expect(v, `${label}: empty/undefined choice`).not.toBe('undefined')
  }
  expect(q.explanation.trim().length, `${label}: empty explanation`).toBeGreaterThan(0)
}

// These reference banks are independent copies, not imports from
// lib/english/generator.ts - the point is to catch a mistake in the
// generator's own bank, not just confirm the generator agrees with itself.

// ── Parts of Speech ──────────────────────────────────────────────────────────

const WORD_BANK: { word: string; pos: 'noun' | 'verb' | 'adjective' | 'adverb' }[] = [
  { word: 'dog', pos: 'noun' }, { word: 'teacher', pos: 'noun' }, { word: 'city', pos: 'noun' },
  { word: 'apple', pos: 'noun' }, { word: 'river', pos: 'noun' }, { word: 'friend', pos: 'noun' },
  { word: 'school', pos: 'noun' }, { word: 'mountain', pos: 'noun' },
  { word: 'run', pos: 'verb' }, { word: 'jump', pos: 'verb' }, { word: 'sing', pos: 'verb' },
  { word: 'write', pos: 'verb' }, { word: 'swim', pos: 'verb' }, { word: 'laugh', pos: 'verb' },
  { word: 'build', pos: 'verb' }, { word: 'read', pos: 'verb' },
  { word: 'happy', pos: 'adjective' }, { word: 'blue', pos: 'adjective' }, { word: 'tall', pos: 'adjective' },
  { word: 'quiet', pos: 'adjective' }, { word: 'brave', pos: 'adjective' }, { word: 'shiny', pos: 'adjective' },
  { word: 'ancient', pos: 'adjective' }, { word: 'curious', pos: 'adjective' },
  { word: 'quickly', pos: 'adverb' }, { word: 'silently', pos: 'adverb' }, { word: 'happily', pos: 'adverb' },
  { word: 'carefully', pos: 'adverb' }, { word: 'loudly', pos: 'adverb' }, { word: 'bravely', pos: 'adverb' },
]

describe('genPartsOfSpeech', () => {
  const allowedByTier = {
    1: ['noun', 'verb'],
    2: ['noun', 'verb', 'adjective'],
    3: ['noun', 'verb', 'adjective', 'adverb'],
  } as const

  for (const tier of [1, 2, 3] as const) {
    test(`tier ${tier}: ${SAMPLES} samples — correct part of speech identified`, () => {
      const questions = times(SAMPLES, () => generateQuestion('english-parts-of-speech', tier))
      for (const q of questions) {
        const match = q.prompt.match(/Which word is (an?) (noun|verb|adjective|adverb)\?/)
        expect(match, 'prompt format mismatch').toBeTruthy()
        const article = match![1], askedPos = match![2]
        expect(allowedByTier[tier], `tier ${tier} should not ask about ${askedPos}`).toContain(askedPos)
        const expectedArticle = askedPos === 'adjective' || askedPos === 'adverb' ? 'an' : 'a'
        expect(article, `wrong article for "${askedPos}"`).toBe(expectedArticle)

        const entry = WORD_BANK.find(w => w.word === q.answer)
        expect(entry, `"${q.answer}" not found in word bank`).toBeTruthy()
        expect(entry!.pos, `"${q.answer}" is not actually a ${askedPos}`).toBe(askedPos)

        assertChoiceInvariants(q, `pos t${tier} ${q.answer}`)
      }
    })
  }
})

// ── Subject-Verb Agreement ───────────────────────────────────────────────────

const SVA_VERB_BANK: { base: string; singular: string; plural: string }[] = [
  { base: 'run', singular: 'runs', plural: 'run' },
  { base: 'jump', singular: 'jumps', plural: 'jump' },
  { base: 'sing', singular: 'sings', plural: 'sing' },
  { base: 'write', singular: 'writes', plural: 'write' },
  { base: 'play', singular: 'plays', plural: 'play' },
  { base: 'walk', singular: 'walks', plural: 'walk' },
  { base: 'read', singular: 'reads', plural: 'read' },
  { base: 'eat', singular: 'eats', plural: 'eat' },
  { base: 'watch', singular: 'watches', plural: 'watch' },
  { base: 'catch', singular: 'catches', plural: 'catch' },
]

const SVA_SUBJECT_BANK: { text: string; takesBaseForm: boolean }[] = [
  { text: 'The dog', takesBaseForm: false }, { text: 'The dogs', takesBaseForm: true },
  { text: 'She', takesBaseForm: false }, { text: 'He', takesBaseForm: false }, { text: 'It', takesBaseForm: false },
  { text: 'They', takesBaseForm: true }, { text: 'We', takesBaseForm: true }, { text: 'The children', takesBaseForm: true },
  { text: 'My friend', takesBaseForm: false }, { text: 'My friends', takesBaseForm: true },
  { text: 'The teacher', takesBaseForm: false }, { text: 'The teachers', takesBaseForm: true },
  { text: 'I', takesBaseForm: true }, { text: 'You', takesBaseForm: true },
]

describe('genSubjectVerbAgreement', () => {
  for (const tier of [1, 2, 3] as const) {
    test(`tier ${tier}: ${SAMPLES} samples — correct verb form`, () => {
      const questions = times(SAMPLES, () => generateQuestion('english-subject-verb-agreement', tier))
      for (const q of questions) {
        const match = q.prompt.match(/^(.+) ___ every day\. \((\w+)\)$/)
        expect(match, 'prompt format mismatch').toBeTruthy()
        const subjectText = match![1], verbBase = match![2]

        const subject = SVA_SUBJECT_BANK.find(s => s.text === subjectText)
        expect(subject, `unknown subject "${subjectText}"`).toBeTruthy()
        if (tier < 3) expect(subjectText, 'I/You should only appear at tier 3').not.toMatch(/^(I|You)$/)

        const verb = SVA_VERB_BANK.find(v => v.base === verbBase)
        expect(verb, `unknown verb "${verbBase}"`).toBeTruthy()
        if (tier === 1) expect(SVA_VERB_BANK.indexOf(verb!), 'tier 1 should only use the first 6 verbs').toBeLessThan(6)

        const expected = subject!.takesBaseForm ? verb!.plural : verb!.singular
        expect(q.answer, `"${subjectText}" + "${verbBase}"`).toBe(expected)

        assertChoiceInvariants(q, `sva t${tier} ${subjectText}/${verbBase}`)
      }
    })
  }
})

// ── Tenses ────────────────────────────────────────────────────────────────────

const TENSE_VERB_BANK: { base: string; past: string }[] = [
  { base: 'walk', past: 'walked' }, { base: 'play', past: 'played' }, { base: 'jump', past: 'jumped' },
  { base: 'talk', past: 'talked' }, { base: 'watch', past: 'watched' }, { base: 'help', past: 'helped' },
  { base: 'go', past: 'went' }, { base: 'run', past: 'ran' }, { base: 'eat', past: 'ate' },
  { base: 'see', past: 'saw' }, { base: 'write', past: 'wrote' }, { base: 'sing', past: 'sang' },
  { base: 'swim', past: 'swam' }, { base: 'give', past: 'gave' }, { base: 'take', past: 'took' },
]

describe('genTenses', () => {
  for (const tier of [1, 2, 3] as const) {
    test(`tier ${tier}: ${SAMPLES} samples — correct tense conjugation`, () => {
      const questions = times(SAMPLES, () => generateQuestion('english-tenses', tier))
      for (const q of questions) {
        const forwardMatch = q.prompt.match(/^What is the past tense of "(\w+)"\?$/)
        const reverseMatch = q.prompt.match(/^"(\w+)" is the past tense of which word\?$/)
        expect(forwardMatch || reverseMatch, 'prompt format mismatch').toBeTruthy()

        if (forwardMatch) {
          const base = forwardMatch[1]
          const entry = TENSE_VERB_BANK.find(v => v.base === base)
          expect(entry, `unknown base verb "${base}"`).toBeTruthy()
          if (tier === 1) expect(TENSE_VERB_BANK.indexOf(entry!), 'tier 1 should only use the first 6 verbs').toBeLessThan(6)
          expect(q.answer, `past tense of "${base}"`).toBe(entry!.past)
        } else {
          expect(tier, 'reverse-direction question only appears at tier >= 2').toBeGreaterThanOrEqual(2)
          const past = reverseMatch![1]
          const entry = TENSE_VERB_BANK.find(v => v.past === past)
          expect(entry, `unknown past form "${past}"`).toBeTruthy()
          expect(q.answer, `base form of "${past}"`).toBe(entry!.base)
        }

        assertChoiceInvariants(q, `tenses t${tier}`)
      }
    })
  }
})

// ── Punctuation ───────────────────────────────────────────────────────────────

const PUNCTUATION_BANK: { sentence: string; correct: '.' | '?' | '!' }[] = [
  { sentence: 'The sun is shining today', correct: '.' },
  { sentence: 'What time is it', correct: '?' },
  { sentence: 'I can not believe we won', correct: '!' },
  { sentence: 'She walked to the store', correct: '.' },
  { sentence: 'Where did you put my book', correct: '?' },
  { sentence: 'Watch out for that car', correct: '!' },
  { sentence: 'My favorite color is green', correct: '.' },
  { sentence: 'How many pets do you have', correct: '?' },
  { sentence: 'That was the best game ever', correct: '!' },
  { sentence: 'We are going to the park', correct: '.' },
  { sentence: 'Why is the sky blue', correct: '?' },
  { sentence: 'Run, the bus is leaving', correct: '!' },
]

describe('genPunctuation', () => {
  for (const tier of [1, 2] as const) {
    test(`tier ${tier}: ${SAMPLES} samples — correct ending punctuation`, () => {
      const questions = times(SAMPLES, () => generateQuestion('english-punctuation', tier))
      for (const q of questions) {
        const match = q.prompt.match(/^What punctuation mark ends this sentence: "(.+)"\?$/)
        expect(match, 'prompt format mismatch').toBeTruthy()
        const sentence = match![1]
        const entry = PUNCTUATION_BANK.find(e => e.sentence === sentence)
        expect(entry, `unknown sentence "${sentence}"`).toBeTruthy()
        if (tier === 1) expect(PUNCTUATION_BANK.indexOf(entry!), 'tier 1 should only use the first 6 sentences').toBeLessThan(6)
        expect(q.answer, `punctuation for "${sentence}"`).toBe(entry!.correct)
        assertChoiceInvariants(q, `punctuation t${tier} "${sentence}"`)
      }
    })
  }

  test(`tier 3: ${SAMPLES} samples — correctly-punctuated sentence identified`, () => {
    const questions = times(SAMPLES, () => generateQuestion('english-punctuation', 3))
    for (const q of questions) {
      expect(q.prompt, 'prompt format mismatch').toBe('Which sentence is punctuated correctly?')
      const match = q.answer.match(/^(.+)([.?!])$/)
      expect(match, 'answer format mismatch').toBeTruthy()
      const sentence = match![1], mark = match![2]
      const entry = PUNCTUATION_BANK.find(e => e.sentence === sentence)
      expect(entry, `unknown sentence "${sentence}"`).toBeTruthy()
      expect(mark, `punctuation for "${sentence}"`).toBe(entry!.correct)
      assertChoiceInvariants(q, `punctuation t3 "${sentence}"`)
    }
  })
})

// ── Capitalization ────────────────────────────────────────────────────────────

const CAPITALIZATION_BANK: { sentence: string; wrong: string; correct: string }[] = [
  { sentence: 'we visited paris last summer', wrong: 'paris', correct: 'Paris' },
  { sentence: 'my birthday is in october', wrong: 'october', correct: 'October' },
  { sentence: 'i love reading books by roald dahl', wrong: 'roald dahl', correct: 'Roald Dahl' },
  { sentence: 'she lives near the amazon river', wrong: 'amazon', correct: 'Amazon' },
  { sentence: 'we celebrate thanksgiving in november', wrong: 'thanksgiving', correct: 'Thanksgiving' },
  { sentence: 'my favorite team is the yankees', wrong: 'yankees', correct: 'Yankees' },
  { sentence: 'monday is my busiest day', wrong: 'monday', correct: 'Monday' },
  { sentence: 'he was born in texas', wrong: 'texas', correct: 'Texas' },
]

describe('genCapitalization', () => {
  for (const tier of [1, 2] as const) {
    test(`tier ${tier}: ${SAMPLES} samples — correct word identified`, () => {
      const questions = times(SAMPLES, () => generateQuestion('english-capitalization', tier))
      for (const q of questions) {
        const match = q.prompt.match(/^Which word should be capitalized in this sentence: "(.+)"\?$/)
        expect(match, 'prompt format mismatch').toBeTruthy()
        const sentence = match![1]
        const entry = CAPITALIZATION_BANK.find(e => e.sentence === sentence)
        expect(entry, `unknown sentence "${sentence}"`).toBeTruthy()
        expect(q.answer, `capitalization target for "${sentence}"`).toBe(entry!.wrong.split(' ')[0])
        assertChoiceInvariants(q, `cap t${tier} "${sentence}"`)
      }
    })
  }

  test(`tier 3: ${SAMPLES} samples — correct capitalized form supplied`, () => {
    const questions = times(SAMPLES, () => generateQuestion('english-capitalization', 3))
    for (const q of questions) {
      const match = q.prompt.match(/^How should "(.+)" be written in this sentence: "(.+)"\?$/)
      expect(match, 'prompt format mismatch').toBeTruthy()
      const wrong = match![1], sentence = match![2]
      const entry = CAPITALIZATION_BANK.find(e => e.sentence === sentence && e.wrong === wrong)
      expect(entry, `unknown sentence/word pair "${sentence}" / "${wrong}"`).toBeTruthy()
      expect(q.answer, `corrected form of "${wrong}"`).toBe(entry!.correct)
      assertChoiceInvariants(q, `cap t3 "${sentence}"`)
    }
  })
})

// ── Plurals ───────────────────────────────────────────────────────────────────

const PLURAL_BANK: { singular: string; plural: string }[] = [
  { singular: 'cat', plural: 'cats' }, { singular: 'dog', plural: 'dogs' }, { singular: 'book', plural: 'books' },
  { singular: 'box', plural: 'boxes' }, { singular: 'bus', plural: 'buses' }, { singular: 'dish', plural: 'dishes' },
  { singular: 'baby', plural: 'babies' }, { singular: 'city', plural: 'cities' }, { singular: 'party', plural: 'parties' },
  { singular: 'child', plural: 'children' }, { singular: 'mouse', plural: 'mice' }, { singular: 'goose', plural: 'geese' },
  { singular: 'foot', plural: 'feet' }, { singular: 'tooth', plural: 'teeth' }, { singular: 'person', plural: 'people' },
  { singular: 'man', plural: 'men' }, { singular: 'woman', plural: 'women' }, { singular: 'leaf', plural: 'leaves' },
]

describe('genPlurals', () => {
  for (const tier of [1, 2, 3] as const) {
    test(`tier ${tier}: ${SAMPLES} samples — correct plural form`, () => {
      const questions = times(SAMPLES, () => generateQuestion('english-plurals', tier))
      for (const q of questions) {
        const match = q.prompt.match(/^What is the plural of "(\w+)"\?$/)
        expect(match, 'prompt format mismatch').toBeTruthy()
        const singular = match![1]
        const entry = PLURAL_BANK.find(e => e.singular === singular)
        expect(entry, `unknown singular "${singular}"`).toBeTruthy()

        const idx = PLURAL_BANK.indexOf(entry!)
        if (tier === 1) expect(idx, 'tier 1 should only use the first 3 entries').toBeLessThan(3)
        if (tier === 2) expect(idx, 'tier 2 should only use the first 9 entries').toBeLessThan(9)
        if (tier === 3) expect(idx, 'tier 3 should only use entries from index 9 on').toBeGreaterThanOrEqual(9)

        expect(q.answer, `plural of "${singular}"`).toBe(entry!.plural)
        assertChoiceInvariants(q, `plurals t${tier} ${singular}`)
      }
    })
  }
})
