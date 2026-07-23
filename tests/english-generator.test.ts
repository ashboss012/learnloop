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

const WORD_BANK: { word: string; pos: 'noun' | 'verb' | 'adjective' | 'adverb'; tier: 1 | 4 | 5 }[] = [
  { word: 'dog', pos: 'noun', tier: 1 }, { word: 'teacher', pos: 'noun', tier: 1 }, { word: 'city', pos: 'noun', tier: 1 },
  { word: 'apple', pos: 'noun', tier: 1 }, { word: 'river', pos: 'noun', tier: 1 }, { word: 'friend', pos: 'noun', tier: 1 },
  { word: 'school', pos: 'noun', tier: 1 }, { word: 'mountain', pos: 'noun', tier: 1 },
  { word: 'run', pos: 'verb', tier: 1 }, { word: 'jump', pos: 'verb', tier: 1 }, { word: 'sing', pos: 'verb', tier: 1 },
  { word: 'write', pos: 'verb', tier: 1 }, { word: 'swim', pos: 'verb', tier: 1 }, { word: 'laugh', pos: 'verb', tier: 1 },
  { word: 'build', pos: 'verb', tier: 1 }, { word: 'read', pos: 'verb', tier: 1 },
  { word: 'happy', pos: 'adjective', tier: 1 }, { word: 'blue', pos: 'adjective', tier: 1 }, { word: 'tall', pos: 'adjective', tier: 1 },
  { word: 'quiet', pos: 'adjective', tier: 1 }, { word: 'brave', pos: 'adjective', tier: 1 }, { word: 'shiny', pos: 'adjective', tier: 1 },
  { word: 'ancient', pos: 'adjective', tier: 1 }, { word: 'curious', pos: 'adjective', tier: 1 },
  { word: 'quickly', pos: 'adverb', tier: 1 }, { word: 'silently', pos: 'adverb', tier: 1 }, { word: 'happily', pos: 'adverb', tier: 1 },
  { word: 'carefully', pos: 'adverb', tier: 1 }, { word: 'loudly', pos: 'adverb', tier: 1 }, { word: 'bravely', pos: 'adverb', tier: 1 },
  { word: 'ecosystem', pos: 'noun', tier: 4 }, { word: 'metropolis', pos: 'noun', tier: 4 },
  { word: 'construct', pos: 'verb', tier: 4 }, { word: 'analyze', pos: 'verb', tier: 4 },
  { word: 'mysterious', pos: 'adjective', tier: 4 }, { word: 'vigilant', pos: 'adjective', tier: 4 },
  { word: 'reluctantly', pos: 'adverb', tier: 4 }, { word: 'meticulously', pos: 'adverb', tier: 4 },
  { word: 'phenomenon', pos: 'noun', tier: 5 }, { word: 'catastrophe', pos: 'noun', tier: 5 },
  { word: 'orchestrate', pos: 'verb', tier: 5 }, { word: 'contemplate', pos: 'verb', tier: 5 },
  { word: 'inevitable', pos: 'adjective', tier: 5 }, { word: 'elaborate', pos: 'adjective', tier: 5 },
  { word: 'inadvertently', pos: 'adverb', tier: 5 }, { word: 'conscientiously', pos: 'adverb', tier: 5 },
]

describe('genPartsOfSpeech', () => {
  const allowedByTier = {
    1: ['noun', 'verb'],
    2: ['noun', 'verb', 'adjective'],
    3: ['noun', 'verb', 'adjective', 'adverb'],
    4: ['noun', 'verb', 'adjective', 'adverb'],
    5: ['noun', 'verb', 'adjective', 'adverb'],
  } as const

  for (const tier of [1, 2, 3, 4, 5] as const) {
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
        expect(entry!.tier, `"${q.answer}" (tier ${entry!.tier}) used above its unlock tier ${tier}`).toBeLessThanOrEqual(tier)

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
  { base: 'fly', singular: 'flies', plural: 'fly' },
  { base: 'try', singular: 'tries', plural: 'try' },
  { base: 'carry', singular: 'carries', plural: 'carry' },
  { base: 'study', singular: 'studies', plural: 'study' },
  { base: 'wash', singular: 'washes', plural: 'wash' },
  { base: 'fix', singular: 'fixes', plural: 'fix' },
  { base: 'mix', singular: 'mixes', plural: 'mix' },
  { base: 'buzz', singular: 'buzzes', plural: 'buzz' },
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
  const verbCountByTier = { 1: 6, 2: 10, 3: 10, 4: 14, 5: 18 } as const

  for (const tier of [1, 2, 3, 4, 5] as const) {
    test(`tier ${tier}: ${SAMPLES} samples — correct verb form`, () => {
      const questions = times(SAMPLES, () => generateQuestion('english-subject-verb-agreement', tier))
      for (const q of questions) {
        const match = q.prompt.match(/^(.+) ___ every day\. \((\w+)\)$/)
        expect(match, 'prompt format mismatch').toBeTruthy()
        const subjectText = match![1], verbBase = match![2]

        const subject = SVA_SUBJECT_BANK.find(s => s.text === subjectText)
        expect(subject, `unknown subject "${subjectText}"`).toBeTruthy()
        if (tier < 3) expect(subjectText, 'I/You should only appear at tier >= 3').not.toMatch(/^(I|You)$/)

        const verb = SVA_VERB_BANK.find(v => v.base === verbBase)
        expect(verb, `unknown verb "${verbBase}"`).toBeTruthy()
        expect(SVA_VERB_BANK.indexOf(verb!), `tier ${tier} verb pool exceeded`).toBeLessThan(verbCountByTier[tier])

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
  { base: 'begin', past: 'began' }, { base: 'break', past: 'broke' },
  { base: 'choose', past: 'chose' }, { base: 'drive', past: 'drove' },
  { base: 'fly', past: 'flew' }, { base: 'freeze', past: 'froze' },
  { base: 'steal', past: 'stole' }, { base: 'throw', past: 'threw' },
]

describe('genTenses', () => {
  const poolCountByTier = { 1: 6, 2: 15, 3: 15, 4: 19, 5: 23 } as const

  for (const tier of [1, 2, 3, 4, 5] as const) {
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
          expect(TENSE_VERB_BANK.indexOf(entry!), `tier ${tier} verb pool exceeded`).toBeLessThan(poolCountByTier[tier])
          expect(q.answer, `past tense of "${base}"`).toBe(entry!.past)
        } else {
          expect(tier, 'reverse-direction question only appears at tier >= 3').toBeGreaterThanOrEqual(3)
          const past = reverseMatch![1]
          const entry = TENSE_VERB_BANK.find(v => v.past === past)
          expect(entry, `unknown past form "${past}"`).toBeTruthy()
          expect(TENSE_VERB_BANK.indexOf(entry!), `tier ${tier} verb pool exceeded`).toBeLessThan(poolCountByTier[tier])
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

const COMMA_BANK: { correct: string; missing: string; tier: 4 | 5 }[] = [
  { correct: 'I packed a hat, a scarf, and gloves.', missing: 'I packed a hat a scarf and gloves.', tier: 4 },
  { correct: 'She bought apples, bananas, and grapes.', missing: 'She bought apples bananas and grapes.', tier: 4 },
  { correct: 'We saw lions, tigers, and bears at the zoo.', missing: 'We saw lions tigers and bears at the zoo.', tier: 4 },
  { correct: 'He likes soccer, basketball, and baseball.', missing: 'He likes soccer basketball and baseball.', tier: 4 },
  { correct: 'The bag had pencils, erasers, and crayons.', missing: 'The bag had pencils erasers and crayons.', tier: 4 },
  { correct: 'My friends are Sam, Ana, and Leo.', missing: 'My friends are Sam Ana and Leo.', tier: 4 },
  { correct: 'We packed sandwiches, chips, fruit, and juice.', missing: 'We packed sandwiches chips fruit and juice.', tier: 5 },
  { correct: 'The garden has roses, tulips, daisies, and lilies.', missing: 'The garden has roses tulips daisies and lilies.', tier: 5 },
  { correct: 'Yesterday, we cleaned the house, washed the car, and mowed the lawn.', missing: 'Yesterday we cleaned the house washed the car and mowed the lawn.', tier: 5 },
  { correct: 'Before dinner, she set the table, lit a candle, and poured water.', missing: 'Before dinner she set the table lit a candle and poured water.', tier: 5 },
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

  for (const tier of [4, 5] as const) {
    test(`tier ${tier}: ${SAMPLES} samples — comma-correct sentence identified`, () => {
      const questions = times(SAMPLES, () => generateQuestion('english-punctuation', tier))
      for (const q of questions) {
        expect(q.prompt, 'prompt format mismatch').toBe('Which sentence uses commas correctly?')
        const entry = COMMA_BANK.find(e => e.correct === q.answer)
        expect(entry, `unknown sentence "${q.answer}"`).toBeTruthy()
        expect(entry!.tier, `tier ${tier} used a tier-${entry!.tier} sentence`).toBeLessThanOrEqual(tier)
        // the answer must actually contain commas, and stripping them must
        // reproduce a plausible "missing commas" distractor
        expect(q.answer, 'answer should contain at least one comma').toMatch(/,/)
        expect(q.answer.replace(/,/g, ''), 'comma-stripped answer mismatch').toBe(entry!.missing)
        assertChoiceInvariants(q, `punctuation t${tier} "${q.answer}"`)
      }
    })
  }
})

// ── Capitalization ────────────────────────────────────────────────────────────

const CAPITALIZATION_BANK: { sentence: string; wrong: string; correct: string; tier: 1 | 5 }[] = [
  { sentence: 'we visited paris last summer', wrong: 'paris', correct: 'Paris', tier: 1 },
  { sentence: 'my birthday is in october', wrong: 'october', correct: 'October', tier: 1 },
  { sentence: 'i love reading books by roald dahl', wrong: 'roald dahl', correct: 'Roald Dahl', tier: 1 },
  { sentence: 'she lives near the amazon river', wrong: 'amazon', correct: 'Amazon', tier: 1 },
  { sentence: 'we celebrate thanksgiving in november', wrong: 'thanksgiving', correct: 'Thanksgiving', tier: 1 },
  { sentence: 'my favorite team is the yankees', wrong: 'yankees', correct: 'Yankees', tier: 1 },
  { sentence: 'monday is my busiest day', wrong: 'monday', correct: 'Monday', tier: 1 },
  { sentence: 'he was born in texas', wrong: 'texas', correct: 'Texas', tier: 1 },
  { sentence: 'my uncle lives in san francisco', wrong: 'san francisco', correct: 'San Francisco', tier: 5 },
  { sentence: 'she is reading a book about helen keller', wrong: 'helen keller', correct: 'Helen Keller', tier: 5 },
]

function capFirst(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1) }

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
        expect(entry!.tier, `tier ${tier} should only use tier-1 sentences`).toBe(1)
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
      expect(entry!.tier, 'tier 3 should only use tier-1 sentences').toBe(1)
      expect(q.answer, `corrected form of "${wrong}"`).toBe(entry!.correct)
      assertChoiceInvariants(q, `cap t3 "${sentence}"`)
    }
  })

  for (const tier of [4, 5] as const) {
    test(`tier ${tier}: ${SAMPLES} samples — fully capitalized sentence identified`, () => {
      const questions = times(SAMPLES, () => generateQuestion('english-capitalization', tier))
      for (const q of questions) {
        expect(q.prompt, 'prompt format mismatch').toBe('Which sentence is capitalized correctly?')
        const entry = CAPITALIZATION_BANK.find(e => capFirst(e.sentence.replace(e.wrong, e.correct)) === q.answer)
        expect(entry, `unknown answer "${q.answer}"`).toBeTruthy()
        if (tier === 4) expect(entry!.tier, 'tier 4 should only use tier-1 sentences').toBe(1)
        // sentence-initial letter and the proper noun must both be capitalized
        expect(q.answer[0], 'first letter should be capitalized').toBe(q.answer[0].toUpperCase())
        expect(q.answer, `should contain the capitalized proper noun "${entry!.correct}"`).toContain(entry!.correct)
        assertChoiceInvariants(q, `cap t${tier} "${q.answer}"`)
      }
    })
  }
})

// ── Plurals ───────────────────────────────────────────────────────────────────

const PLURAL_BANK: { singular: string; plural: string }[] = [
  { singular: 'cat', plural: 'cats' }, { singular: 'dog', plural: 'dogs' }, { singular: 'book', plural: 'books' },
  { singular: 'box', plural: 'boxes' }, { singular: 'bus', plural: 'buses' }, { singular: 'dish', plural: 'dishes' },
  { singular: 'baby', plural: 'babies' }, { singular: 'city', plural: 'cities' }, { singular: 'party', plural: 'parties' },
  { singular: 'child', plural: 'children' }, { singular: 'mouse', plural: 'mice' }, { singular: 'goose', plural: 'geese' },
  { singular: 'foot', plural: 'feet' }, { singular: 'tooth', plural: 'teeth' }, { singular: 'person', plural: 'people' },
  { singular: 'man', plural: 'men' }, { singular: 'woman', plural: 'women' }, { singular: 'leaf', plural: 'leaves' },
  { singular: 'wife', plural: 'wives' }, { singular: 'knife', plural: 'knives' },
  { singular: 'half', plural: 'halves' }, { singular: 'shelf', plural: 'shelves' },
  { singular: 'sheep', plural: 'sheep' }, { singular: 'fish', plural: 'fish' },
  { singular: 'deer', plural: 'deer' }, { singular: 'moose', plural: 'moose' },
]

describe('genPlurals', () => {
  for (const tier of [1, 2, 3, 4, 5] as const) {
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
        if (tier === 3) { expect(idx, 'tier 3 range').toBeGreaterThanOrEqual(9); expect(idx).toBeLessThan(18) }
        if (tier === 4) { expect(idx, 'tier 4 range').toBeGreaterThanOrEqual(18); expect(idx).toBeLessThan(22) }
        if (tier === 5) { expect(idx, 'tier 5 range').toBeGreaterThanOrEqual(22); expect(idx).toBeLessThan(26) }

        expect(q.answer, `plural of "${singular}"`).toBe(entry!.plural)
        assertChoiceInvariants(q, `plurals t${tier} ${singular}`)
      }
    })
  }
})

// ── Vocabulary ────────────────────────────────────────────────────────────────

const VOCAB_BANK: { word: string; definition: string; synonym: string; antonym: string; sentence: string; tier: 1 | 2 | 3 | 4 | 5 }[] = [
  { word: 'happy', definition: 'feeling pleased or glad', synonym: 'joyful', antonym: 'sad', sentence: 'She felt ___ when she won the race.', tier: 1 },
  { word: 'quick', definition: 'moving or acting fast', synonym: 'fast', antonym: 'slow', sentence: 'The rabbit was ___ across the field.', tier: 1 },
  { word: 'big', definition: 'large in size', synonym: 'huge', antonym: 'small', sentence: 'The elephant is a ___ animal.', tier: 1 },
  { word: 'brave', definition: 'not afraid of danger', synonym: 'courageous', antonym: 'fearful', sentence: 'The firefighter was ___ when she ran into the building.', tier: 1 },
  { word: 'kind', definition: 'friendly and caring toward others', synonym: 'gentle', antonym: 'mean', sentence: 'It was ___ of him to share his lunch.', tier: 1 },
  { word: 'loud', definition: 'making a lot of noise', synonym: 'noisy', antonym: 'quiet', sentence: 'The thunder was so ___ it woke everyone up.', tier: 1 },
  { word: 'enormous', definition: 'extremely large in size', synonym: 'gigantic', antonym: 'tiny', sentence: 'The blue whale is an ___ animal.', tier: 2 },
  { word: 'curious', definition: 'eager to learn or know something', synonym: 'inquisitive', antonym: 'indifferent', sentence: 'The ___ cat explored every corner of the house.', tier: 2 },
  { word: 'furious', definition: 'extremely angry', synonym: 'enraged', antonym: 'calm', sentence: 'Dad was ___ when he saw the broken window.', tier: 2 },
  { word: 'ancient', definition: 'very old, from long ago', synonym: 'antique', antonym: 'modern', sentence: 'We saw ___ ruins on our trip.', tier: 2 },
  { word: 'delighted', definition: 'very pleased and happy', synonym: 'thrilled', antonym: 'disappointed', sentence: 'She was ___ to receive the gift.', tier: 2 },
  { word: 'exhausted', definition: 'extremely tired', synonym: 'weary', antonym: 'energetic', sentence: 'After the long hike, we were completely ___.', tier: 2 },
  { word: 'reluctant', definition: 'unwilling and hesitant', synonym: 'hesitant', antonym: 'eager', sentence: 'He was ___ to try the new food at first.', tier: 3 },
  { word: 'magnificent', definition: 'extremely beautiful or impressive', synonym: 'splendid', antonym: 'ordinary', sentence: 'The view from the mountain was ___.', tier: 3 },
  { word: 'persistent', definition: 'continuing firmly despite difficulty', synonym: 'determined', antonym: 'quitting', sentence: 'She was ___ in practicing until she learned to ride a bike.', tier: 3 },
  { word: 'cautious', definition: 'careful to avoid danger or mistakes', synonym: 'careful', antonym: 'reckless', sentence: 'Be ___ when crossing a busy street.', tier: 3 },
  { word: 'generous', definition: 'willing to give and share freely', synonym: 'giving', antonym: 'selfish', sentence: 'The ___ neighbor gave cookies to everyone on the block.', tier: 3 },
  { word: 'timid', definition: 'shy and easily frightened', synonym: 'shy', antonym: 'bold', sentence: 'The ___ puppy hid behind the couch.', tier: 3 },
  { word: 'anxious', definition: 'feeling worried or nervous', synonym: 'nervous', antonym: 'calm', sentence: 'He felt ___ before the big test.', tier: 4 },
  { word: 'diligent', definition: 'showing careful and steady effort', synonym: 'hardworking', antonym: 'lazy', sentence: 'The ___ student finished her homework early.', tier: 4 },
  { word: 'fragile', definition: 'easily broken or damaged', synonym: 'delicate', antonym: 'sturdy', sentence: 'Please handle the ___ vase with care.', tier: 4 },
  { word: 'humble', definition: 'not proud or boastful', synonym: 'modest', antonym: 'arrogant', sentence: 'Despite winning, she stayed ___.', tier: 4 },
  { word: 'peculiar', definition: 'strange or unusual', synonym: 'odd', antonym: 'ordinary', sentence: 'We heard a ___ noise coming from the attic.', tier: 4 },
  { word: 'vivid', definition: 'producing powerful, clear images in the mind', synonym: 'vibrant', antonym: 'dull', sentence: 'The sunset painted the sky in ___ colors.', tier: 4 },
  { word: 'meticulous', definition: 'extremely careful and precise', synonym: 'thorough', antonym: 'careless', sentence: 'The scientist was ___ when recording her data.', tier: 5 },
  { word: 'resilient', definition: 'able to recover quickly from difficulty', synonym: 'tough', antonym: 'fragile', sentence: 'The ___ team bounced back after losing the first game.', tier: 5 },
  { word: 'skeptical', definition: 'having doubts about something', synonym: 'doubtful', antonym: 'trusting', sentence: 'She was ___ about the surprising claim.', tier: 5 },
  { word: 'tedious', definition: 'long, slow, and boring', synonym: 'monotonous', antonym: 'exciting', sentence: 'Filling out the long form was a ___ task.', tier: 5 },
  { word: 'unanimous', definition: 'agreed on by everyone', synonym: 'united', antonym: 'divided', sentence: 'The vote was ___ - everyone agreed.', tier: 5 },
  { word: 'vigorous', definition: 'full of energy and effort', synonym: 'energetic', antonym: 'sluggish', sentence: 'The team gave a ___ effort in the final quarter.', tier: 5 },
]

describe('genVocabulary', () => {
  for (const tier of [1, 2, 3, 4, 5] as const) {
    test(`tier ${tier}: ${SAMPLES} samples — correct definition, word, synonym, or antonym`, () => {
      const questions = times(SAMPLES, () => generateQuestion('english-vocabulary', tier))
      const seenTypes = new Set<string>()
      for (const q of questions) {
        const defMatch = q.prompt.match(/^What does "(\w+)" mean\?$/)
        const synAntMatch = q.prompt.match(/^Which word means the (same as|opposite of) "(\w+)"\?$/)
        const fillEntry = VOCAB_BANK.find(w => w.sentence === q.prompt)

        if (defMatch) {
          seenTypes.add('definition')
          const word = defMatch[1]
          const entry = VOCAB_BANK.find(w => w.word === word)
          expect(entry, `unknown word "${word}"`).toBeTruthy()
          expect(entry!.tier, `word "${word}" not from tier ${tier}`).toBe(tier)
          expect(q.answer, `definition of "${word}"`).toBe(entry!.definition)
        } else if (synAntMatch) {
          seenTypes.add('synonym-antonym')
          const relation = synAntMatch[1], word = synAntMatch[2]
          const entry = VOCAB_BANK.find(w => w.word === word)
          expect(entry, `unknown word "${word}"`).toBeTruthy()
          expect(entry!.tier, `word "${word}" not from tier ${tier}`).toBe(tier)
          const expected = relation === 'same as' ? entry!.synonym : entry!.antonym
          expect(q.answer, `${relation} of "${word}"`).toBe(expected)
        } else if (fillEntry) {
          seenTypes.add('fill-blank')
          expect(fillEntry.tier, `sentence "${q.prompt}" not from tier ${tier}`).toBe(tier)
          expect(q.answer, `blank answer for "${q.prompt}"`).toBe(fillEntry.word)
        } else {
          throw new Error(`prompt format mismatch: "${q.prompt}"`)
        }

        assertChoiceInvariants(q, `vocab t${tier} "${q.prompt}"`)
      }
      expect(seenTypes.size, `500 samples should exercise all 3 question types at tier ${tier}`).toBe(3)
    })
  }
})
