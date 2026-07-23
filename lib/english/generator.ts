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
// `tier` on each bank entry is the vocabulary-difficulty level it unlocks at
// (cumulative, same pattern as VOCAB_BANK below) - the 4 part-of-speech
// categories themselves are exhausted by tier 3, so tiers 4-5 widen the pool
// with harder words instead of new categories.
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
  // tier 4: more advanced vocabulary within each part of speech
  { word: 'ecosystem', pos: 'noun', tier: 4 }, { word: 'metropolis', pos: 'noun', tier: 4 },
  { word: 'construct', pos: 'verb', tier: 4 }, { word: 'analyze', pos: 'verb', tier: 4 },
  { word: 'mysterious', pos: 'adjective', tier: 4 }, { word: 'vigilant', pos: 'adjective', tier: 4 },
  { word: 'reluctantly', pos: 'adverb', tier: 4 }, { word: 'meticulously', pos: 'adverb', tier: 4 },
  // tier 5: even more advanced vocabulary
  { word: 'phenomenon', pos: 'noun', tier: 5 }, { word: 'catastrophe', pos: 'noun', tier: 5 },
  { word: 'orchestrate', pos: 'verb', tier: 5 }, { word: 'contemplate', pos: 'verb', tier: 5 },
  { word: 'inevitable', pos: 'adjective', tier: 5 }, { word: 'elaborate', pos: 'adjective', tier: 5 },
  { word: 'inadvertently', pos: 'adverb', tier: 5 }, { word: 'conscientiously', pos: 'adverb', tier: 5 },
]

function genPartsOfSpeech(tier: number): GeneratedQuestion {
  const pools = tier === 1 ? (['noun', 'verb'] as const)
    : tier === 2 ? (['noun', 'verb', 'adjective'] as const)
    : (['noun', 'verb', 'adjective', 'adverb'] as const)
  const inScope = WORD_BANK.filter(w => (pools as readonly string[]).includes(w.pos) && w.tier <= tier)
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
  // tier 4: -y -> -ies verbs
  { base: 'fly', singular: 'flies', plural: 'fly' },
  { base: 'try', singular: 'tries', plural: 'try' },
  { base: 'carry', singular: 'carries', plural: 'carry' },
  { base: 'study', singular: 'studies', plural: 'study' },
  // tier 5: more sibilant-ending -es verbs
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

function genSubjectVerbAgreement(tier: number): GeneratedQuestion {
  const verbPool = tier === 1 ? SVA_VERB_BANK.slice(0, 6)
    : tier <= 3 ? SVA_VERB_BANK.slice(0, 10)
    : tier === 4 ? SVA_VERB_BANK.slice(0, 14)
    : SVA_VERB_BANK
  const subjectPool = tier >= 3 ? SVA_SUBJECT_BANK : SVA_SUBJECT_BANK.filter(s => s.text !== 'I' && s.text !== 'You')
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
  // tier 4: more irregular verbs
  { base: 'begin', past: 'began' }, { base: 'break', past: 'broke' },
  { base: 'choose', past: 'chose' }, { base: 'drive', past: 'drove' },
  // tier 5: even more irregular verbs
  { base: 'fly', past: 'flew' }, { base: 'freeze', past: 'froze' },
  { base: 'steal', past: 'stole' }, { base: 'throw', past: 'threw' },
]

function genTenses(tier: number): GeneratedQuestion {
  const pool = tier === 1 ? TENSE_VERB_BANK.slice(0, 6)
    : tier <= 3 ? TENSE_VERB_BANK.slice(0, 15)
    : tier === 4 ? TENSE_VERB_BANK.slice(0, 19)
    : TENSE_VERB_BANK
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

// Tiers 4-5: comma placement in a series - a genuinely different punctuation
// skill from the sentence-ending marks above. `missing` is always `correct`
// with every comma stripped, so the two versions differ only by commas.
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

function genPunctuation(tier: number): GeneratedQuestion {
  if (tier >= 4) {
    const pool = COMMA_BANK.filter(e => e.tier <= tier)
    const entry = pool[randInt(0, pool.length - 1)]
    const others = shuffle(pool.filter(e => e.correct !== entry.correct)).slice(0, 3).map(o => o.missing)
    return {
      prompt: 'Which sentence uses commas correctly?',
      choices: buildChoices(entry.correct, [entry.missing, ...others]),
      answer: entry.correct,
      explanation: `"${entry.correct}" — use a comma after each item in a list of three or more.`,
      type: 'multiple_choice',
    }
  }
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
const CAPITALIZATION_BANK: { sentence: string; wrong: string; correct: string; tier: 1 | 5 }[] = [
  { sentence: 'we visited paris last summer', wrong: 'paris', correct: 'Paris', tier: 1 },
  { sentence: 'my birthday is in october', wrong: 'october', correct: 'October', tier: 1 },
  { sentence: 'i love reading books by roald dahl', wrong: 'roald dahl', correct: 'Roald Dahl', tier: 1 },
  { sentence: 'she lives near the amazon river', wrong: 'amazon', correct: 'Amazon', tier: 1 },
  { sentence: 'we celebrate thanksgiving in november', wrong: 'thanksgiving', correct: 'Thanksgiving', tier: 1 },
  { sentence: 'my favorite team is the yankees', wrong: 'yankees', correct: 'Yankees', tier: 1 },
  { sentence: 'monday is my busiest day', wrong: 'monday', correct: 'Monday', tier: 1 },
  { sentence: 'he was born in texas', wrong: 'texas', correct: 'Texas', tier: 1 },
  // tier 5: multi-word proper nouns, used only in the tier-5 full-sentence pool
  { sentence: 'my uncle lives in san francisco', wrong: 'san francisco', correct: 'San Francisco', tier: 5 },
  { sentence: 'she is reading a book about helen keller', wrong: 'helen keller', correct: 'Helen Keller', tier: 5 },
]

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function genCapitalization(tier: number): GeneratedQuestion {
  const targetPool = tier === 5 ? CAPITALIZATION_BANK : CAPITALIZATION_BANK.filter(e => e.tier === 1)
  const entry = targetPool[randInt(0, targetPool.length - 1)]
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

  if (tier === 3) {
    return {
      prompt: `How should "${entry.wrong}" be written in this sentence: "${entry.sentence}"?`,
      choices: buildChoices(entry.correct, [entry.wrong, entry.correct.toUpperCase(), entry.wrong.toUpperCase()]),
      answer: entry.correct,
      explanation: `"${entry.correct}" is a proper noun, so every important word is capitalized.`,
      type: 'multiple_choice',
    }
  }

  // Tiers 4-5: the whole sentence must be capitalized correctly - both the
  // sentence-initial word AND the proper noun, not just one in isolation.
  const fullyCorrect = capitalizeFirst(entry.sentence.replace(entry.wrong, entry.correct))
  const onlyProperNoun = entry.sentence.replace(entry.wrong, entry.correct)
  const onlySentenceStart = capitalizeFirst(entry.sentence)
  const neitherCapped = entry.sentence
  return {
    prompt: 'Which sentence is capitalized correctly?',
    choices: buildChoices(fullyCorrect, [onlyProperNoun, onlySentenceStart, neitherCapped]),
    answer: fullyCorrect,
    explanation: `"${fullyCorrect}" — capitalize the first word of a sentence and every proper noun ("${entry.correct}").`,
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
  // tier 4: more -f/-fe -> -ves plurals
  { singular: 'wife', plural: 'wives' }, { singular: 'knife', plural: 'knives' },
  { singular: 'half', plural: 'halves' }, { singular: 'shelf', plural: 'shelves' },
  // tier 5: invariant plurals (same word for singular and plural)
  { singular: 'sheep', plural: 'sheep' }, { singular: 'fish', plural: 'fish' },
  { singular: 'deer', plural: 'deer' }, { singular: 'moose', plural: 'moose' },
]

function genPlurals(tier: number): GeneratedQuestion {
  const pool = tier === 1 ? PLURAL_BANK.slice(0, 3)
    : tier === 2 ? PLURAL_BANK.slice(0, 9)
    : tier === 3 ? PLURAL_BANK.slice(9, 18)
    : tier === 4 ? PLURAL_BANK.slice(18, 22)
    : PLURAL_BANK.slice(22, 26)
  const entry = pool[randInt(0, pool.length - 1)]
  return {
    prompt: `What is the plural of "${entry.singular}"?`,
    choices: buildChoices(entry.plural, [entry.singular + 's', entry.singular + 'es', entry.singular]),
    answer: entry.plural,
    explanation: `The plural of "${entry.singular}" is "${entry.plural}".`,
    type: 'multiple_choice',
  }
}

// Vocabulary - docs/03: "Ground definitions in a known word list for the
// grade so the model is not inventing meanings." This bank IS that known
// list - hand-authored and hand-verified, same trust model as every other
// bank in this file. Three question types per docs/03: definition match,
// fill in the blank, synonym or antonym.
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

function genVocabulary(tier: number): GeneratedQuestion {
  const pool = VOCAB_BANK.filter(w => w.tier === tier)
  const entry = pool[randInt(0, pool.length - 1)]
  const others = shuffle(VOCAB_BANK.filter(w => w.word !== entry.word))
  const qType = randInt(1, 3)

  if (qType === 1) {
    const distractors = others.slice(0, 3).map(o => o.definition)
    return {
      prompt: `What does "${entry.word}" mean?`,
      choices: buildChoices(entry.definition, distractors),
      answer: entry.definition,
      explanation: `"${entry.word}" means ${entry.definition}.`,
      type: 'multiple_choice',
    }
  }

  if (qType === 2) {
    const distractors = shuffle(pool.filter(w => w.word !== entry.word)).slice(0, 3).map(o => o.word)
    return {
      prompt: entry.sentence,
      choices: buildChoices(entry.word, distractors),
      answer: entry.word,
      explanation: `"${entry.word}" fits because it means ${entry.definition}.`,
      type: 'multiple_choice',
    }
  }

  const askSynonym = Math.random() < 0.5
  const correct = askSynonym ? entry.synonym : entry.antonym
  const distractors = others.slice(0, 3).map(o => askSynonym ? o.synonym : o.antonym)
  return {
    prompt: `Which word means the ${askSynonym ? 'same as' : 'opposite of'} "${entry.word}"?`,
    choices: buildChoices(correct, distractors),
    answer: correct,
    explanation: askSynonym
      ? `"${correct}" is a synonym for "${entry.word}" - they mean almost the same thing.`
      : `"${correct}" is an antonym for "${entry.word}" - it means the opposite.`,
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
    case 'english-vocabulary':               return genVocabulary(tier)
    default:                                 return genPartsOfSpeech(tier)
  }
}
