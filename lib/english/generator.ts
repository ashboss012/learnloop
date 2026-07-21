import type { GeneratedQuestion, Choice } from '@/types'

// Grammar is rule-based and verifiable like math (docs/03-content-english.md),
// so it's generated the same way: no LLM at serve time. The "rule" here is a
// small hand-authored, hand-verified word/sentence bank - the bank entries
// are the ground truth, same trust model as a multiplication fact.

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Answers here are words/sentences, not numbers, so this needs its own
// fallback (not math's buildChoices, whose fallback does Number(correct)+n
// and would emit "NaN" for word-shaped answers - the exact bug class fixed
// earlier this session, just for a different answer shape).
const FILLER_WORDS = ['apple', 'happy', 'quickly', 'jumped', 'Monday', 'tigers', 'friend', 'yesterday']

function buildChoices(correct: string, distractors: string[]): Choice[] {
  const seen = new Set<string>([correct])
  const picks: string[] = []
  for (const d of distractors) {
    if (!seen.has(d)) { seen.add(d); picks.push(d) }
    if (picks.length === 3) break
  }
  let i = 0
  while (picks.length < 3 && i < FILLER_WORDS.length) {
    const candidate = FILLER_WORDS[i++]
    if (!seen.has(candidate)) { seen.add(candidate); picks.push(candidate) }
  }
  return shuffle([correct, ...picks]).map(v => ({ label: v, value: v }))
}

// Parts of Speech
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

function genPartsOfSpeech(tier: number): GeneratedQuestion {
  const pools = tier === 1 ? (['noun', 'verb'] as const)
    : tier === 2 ? (['noun', 'verb', 'adjective'] as const)
    : (['noun', 'verb', 'adjective', 'adverb'] as const)
  const inScope = WORD_BANK.filter(w => (pools as readonly string[]).includes(w.pos))
  const targetPos = pools[randInt(0, pools.length - 1)]
  const candidates = inScope.filter(w => w.pos === targetPos)
  const target = candidates[randInt(0, candidates.length - 1)]
  const others = shuffle(inScope.filter(w => w.pos !== targetPos)).slice(0, 3)
  const article = targetPos === 'adjective' || targetPos === 'adverb' ? 'an' : 'a'
  return {
    prompt: `Which word is ${article} ${targetPos}?`,
    choices: buildChoices(target.word, others.map(o => o.word)),
    answer: target.word,
    explanation: `"${target.word}" is a ${targetPos}.`,
    type: 'multiple_choice',
  }
}

// Subject-Verb Agreement
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

function genSubjectVerbAgreement(tier: number): GeneratedQuestion {
  const verbPool = tier === 1 ? SVA_VERB_BANK.slice(0, 6) : SVA_VERB_BANK
  const subjectPool = tier === 3 ? SVA_SUBJECT_BANK : SVA_SUBJECT_BANK.filter(s => s.text !== 'I' && s.text !== 'You')
  const subject = subjectPool[randInt(0, subjectPool.length - 1)]
  const verb = verbPool[randInt(0, verbPool.length - 1)]
  const correct = subject.takesBaseForm ? verb.plural : verb.singular
  const wrong = subject.takesBaseForm ? verb.singular : verb.plural
  return {
    prompt: `${subject.text} ___ every day. (${verb.base})`,
    choices: buildChoices(correct, [wrong, verb.base + 'ed', verb.base + 'ing']),
    answer: correct,
    explanation: subject.takesBaseForm
      ? `"${subject.text}" takes the base form, so the verb stays as "${correct}."`
      : `"${subject.text}" is singular, so we add -s: "${correct}."`,
    type: 'multiple_choice',
  }
}

// Tenses
const TENSE_VERB_BANK: { base: string; past: string }[] = [
  { base: 'walk', past: 'walked' }, { base: 'play', past: 'played' }, { base: 'jump', past: 'jumped' },
  { base: 'talk', past: 'talked' }, { base: 'watch', past: 'watched' }, { base: 'help', past: 'helped' },
  { base: 'go', past: 'went' }, { base: 'run', past: 'ran' }, { base: 'eat', past: 'ate' },
  { base: 'see', past: 'saw' }, { base: 'write', past: 'wrote' }, { base: 'sing', past: 'sang' },
  { base: 'swim', past: 'swam' }, { base: 'give', past: 'gave' }, { base: 'take', past: 'took' },
]

function genTenses(tier: number): GeneratedQuestion {
  const pool = tier === 1 ? TENSE_VERB_BANK.slice(0, 6) : TENSE_VERB_BANK
  const entry = pool[randInt(0, pool.length - 1)]
  const askPast = tier < 3 || Math.random() < 0.5
  if (askPast) {
    return {
      prompt: `What is the past tense of "${entry.base}"?`,
      choices: buildChoices(entry.past, [entry.base + 'ed', entry.base + 's', entry.base]),
      answer: entry.past,
      explanation: `The past tense of "${entry.base}" is "${entry.past}".`,
      type: 'multiple_choice',
    }
  }
  return {
    prompt: `"${entry.past}" is the past tense of which word?`,
    choices: buildChoices(entry.base, [entry.past, entry.base + 'ing', entry.base + 's']),
    answer: entry.base,
    explanation: `"${entry.past}" comes from "${entry.base}".`,
    type: 'multiple_choice',
  }
}

// Punctuation
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

function genPunctuation(tier: number): GeneratedQuestion {
  if (tier === 3) {
    const entry = PUNCTUATION_BANK[randInt(0, PUNCTUATION_BANK.length - 1)]
    const correctVersion = `${entry.sentence}${entry.correct}`
    const others = shuffle(PUNCTUATION_BANK.filter(e => e.sentence !== entry.sentence)).slice(0, 3)
    const distractors = others.map(o => `${o.sentence}${o.correct === '.' ? '?' : '.'}`)
    return {
      prompt: 'Which sentence is punctuated correctly?',
      choices: buildChoices(correctVersion, distractors),
      answer: correctVersion,
      explanation: `"${correctVersion}" uses the correct ending punctuation for its type.`,
      type: 'multiple_choice',
    }
  }
  const pool = tier === 1 ? PUNCTUATION_BANK.slice(0, 6) : PUNCTUATION_BANK
  const entry = pool[randInt(0, pool.length - 1)]
  const allMarks = ['.', '?', '!', ',']
  const distractors = allMarks.filter(m => m !== entry.correct)
  const reason = entry.correct === '.' ? 'a statement ends with a period'
    : entry.correct === '?' ? 'a question ends with a question mark'
    : 'strong feeling or excitement ends with an exclamation point'
  return {
    prompt: `What punctuation mark ends this sentence: "${entry.sentence}"?`,
    choices: buildChoices(entry.correct, distractors),
    answer: entry.correct,
    explanation: `"${entry.sentence}${entry.correct}" — ${reason}.`,
    type: 'multiple_choice',
  }
}

// Capitalization
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

function genCapitalization(tier: number): GeneratedQuestion {
  const entry = CAPITALIZATION_BANK[randInt(0, CAPITALIZATION_BANK.length - 1)]
  const targetWord = entry.wrong.split(' ')[0]

  if (tier < 3) {
    const otherWords = shuffle(entry.sentence.split(' ').filter(w => w !== targetWord && w.length > 2)).slice(0, 3)
    return {
      prompt: `Which word should be capitalized in this sentence: "${entry.sentence}"?`,
      choices: buildChoices(targetWord, otherWords),
      answer: targetWord,
      explanation: `"${entry.correct}" is a proper noun, so it should be capitalized.`,
      type: 'multiple_choice',
    }
  }

  return {
    prompt: `How should "${entry.wrong}" be written in this sentence: "${entry.sentence}"?`,
    choices: buildChoices(entry.correct, [entry.wrong, entry.correct.toUpperCase(), entry.wrong.toUpperCase()]),
    answer: entry.correct,
    explanation: `"${entry.correct}" is a proper noun, so every important word is capitalized.`,
    type: 'multiple_choice',
  }
}

// Plurals
const PLURAL_BANK: { singular: string; plural: string }[] = [
  { singular: 'cat', plural: 'cats' }, { singular: 'dog', plural: 'dogs' }, { singular: 'book', plural: 'books' },
  { singular: 'box', plural: 'boxes' }, { singular: 'bus', plural: 'buses' }, { singular: 'dish', plural: 'dishes' },
  { singular: 'baby', plural: 'babies' }, { singular: 'city', plural: 'cities' }, { singular: 'party', plural: 'parties' },
  { singular: 'child', plural: 'children' }, { singular: 'mouse', plural: 'mice' }, { singular: 'goose', plural: 'geese' },
  { singular: 'foot', plural: 'feet' }, { singular: 'tooth', plural: 'teeth' }, { singular: 'person', plural: 'people' },
  { singular: 'man', plural: 'men' }, { singular: 'woman', plural: 'women' }, { singular: 'leaf', plural: 'leaves' },
]

function genPlurals(tier: number): GeneratedQuestion {
  const pool = tier === 1 ? PLURAL_BANK.slice(0, 3) : tier === 2 ? PLURAL_BANK.slice(0, 9) : PLURAL_BANK.slice(9)
  const entry = pool[randInt(0, pool.length - 1)]
  return {
    prompt: `What is the plural of "${entry.singular}"?`,
    choices: buildChoices(entry.plural, [entry.singular + 's', entry.singular + 'es', entry.singular]),
    answer: entry.plural,
    explanation: `The plural of "${entry.singular}" is "${entry.plural}".`,
    type: 'multiple_choice',
  }
}

export function generateQuestion(slug: string, tier: number): GeneratedQuestion {
  switch (slug) {
    case 'english-parts-of-speech':          return genPartsOfSpeech(tier)
    case 'english-subject-verb-agreement':   return genSubjectVerbAgreement(tier)
    case 'english-tenses':                   return genTenses(tier)
    case 'english-punctuation':              return genPunctuation(tier)
    case 'english-capitalization':           return genCapitalization(tier)
    case 'english-plurals':                  return genPlurals(tier)
    default:                                 return genPartsOfSpeech(tier)
  }
}
