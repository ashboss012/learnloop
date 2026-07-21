// Bots are fake, not real data - "the mix is handled in code and the user
// cannot tell which is which" (docs/06-leaderboard.md). A fixed roster and
// a deterministic pacing function, no stored per-week state, no cron: a
// bot's XP right now is a pure function of (bot, weekStart, now).

export type Personality = 'grinder' | 'casual' | 'sporadic'

export interface Bot {
  id: string
  displayName: string
  emoji: string
  personality: Personality
  weeklyTargetXp: number
}

// Weekly XP targets are a first guess, not calibrated against real usage
// yet - watch and adjust once he's actually used the board a bit
// (docs/10-build-plan.md's own evaluation note for this phase).
export const BOT_ROSTER: Bot[] = [
  { id: 'bot-maya', displayName: 'Maya', emoji: '🦊', personality: 'grinder', weeklyTargetXp: 520 },
  { id: 'bot-leo', displayName: 'Leo', emoji: '🐯', personality: 'grinder', weeklyTargetXp: 460 },
  { id: 'bot-theo', displayName: 'Theo', emoji: '🐙', personality: 'grinder', weeklyTargetXp: 390 },
  { id: 'bot-zoe', displayName: 'Zoe', emoji: '🐼', personality: 'casual', weeklyTargetXp: 260 },
  { id: 'bot-sam', displayName: 'Sam', emoji: '🐨', personality: 'casual', weeklyTargetXp: 210 },
  { id: 'bot-nina', displayName: 'Nina', emoji: '🦉', personality: 'casual', weeklyTargetXp: 180 },
  { id: 'bot-ivy', displayName: 'Ivy', emoji: '🦋', personality: 'casual', weeklyTargetXp: 140 },
  { id: 'bot-kai', displayName: 'Kai', emoji: '🐸', personality: 'sporadic', weeklyTargetXp: 220 },
  { id: 'bot-ruby', displayName: 'Ruby', emoji: '🦄', personality: 'sporadic', weeklyTargetXp: 150 },
]

const ACTIVE_HOURS: Record<Personality, [number, number]> = {
  grinder: [15, 21],
  casual: [16, 20],
  sporadic: [17, 22],
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Most recent Monday at UTC midnight, on or before `now`. */
export function getWeekStart(now: Date = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = d.getUTCDay()
  const daysSinceMonday = (day + 6) % 7
  d.setUTCDate(d.getUTCDate() - daysSinceMonday)
  return d
}

// FNV-1a string hash -> a stable 32-bit seed.
function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// mulberry32 - small, fast, deterministic PRNG from a 32-bit seed.
function mulberry32(seed: number): () => number {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Personality-shaped share of the week's target XP per day, seeded by
// (bot, weekStart) so it's reproducible within a week and different
// week to week - never a function of anything the student does.
function dailyWeights(bot: Bot, weekStart: Date): number[] {
  const rng = mulberry32(hashString(`${bot.id}:${weekStart.toISOString().slice(0, 10)}`))
  const raw: number[] = []
  for (let day = 0; day < 7; day++) {
    let w: number
    if (bot.personality === 'grinder') {
      w = 0.8 + rng() * 0.4
    } else if (bot.personality === 'casual') {
      w = rng() < 0.15 ? 0 : 0.3 + rng() * 1.4
    } else {
      w = rng() < 0.55 ? 0.05 + rng() * 0.15 : 1.5 + rng() * 2
    }
    raw.push(w)
  }
  const total = raw.reduce((a, b) => a + b, 0) || 1
  return raw.map(w => w / total)
}

/** Deterministic, never reactive to the student - a pure function of when "now" is. */
export function botWeeklyXp(bot: Bot, weekStart: Date, now: Date): number {
  const elapsedMs = now.getTime() - weekStart.getTime()
  if (elapsedMs <= 0) return 0

  const dayIndex = Math.min(6, Math.floor(elapsedMs / DAY_MS))
  const weights = dailyWeights(bot, weekStart)

  let xp = 0
  for (let d = 0; d < dayIndex; d++) xp += weights[d] * bot.weeklyTargetXp

  const [startHour, endHour] = ACTIVE_HOURS[bot.personality]
  const dayStart = new Date(weekStart.getTime() + dayIndex * DAY_MS)
  const hourOfDay = (now.getTime() - dayStart.getTime()) / (60 * 60 * 1000)
  const activeFraction = hourOfDay <= startHour ? 0 : hourOfDay >= endHour ? 1 : (hourOfDay - startHour) / (endHour - startHour)
  xp += weights[dayIndex] * bot.weeklyTargetXp * activeFraction

  return Math.round(Math.min(xp, bot.weeklyTargetXp))
}
