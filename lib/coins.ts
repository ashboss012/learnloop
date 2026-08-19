// Coins earned per completed practice session, on top of the flat XP
// award - rewards accuracy and speed the way XP deliberately doesn't
// (XP_PER_SESSION in app/actions/session.ts is flat regardless of
// performance, by design). Every question correct on the first try scores
// full accuracy; a fast average per-question time scores the speed bonus.
// Small tunable constants, no hidden curve.

const BASE_COINS = 5
const PERFECT_ACCURACY_BONUS = 8
const GOOD_ACCURACY_BONUS = 4
const GOOD_ACCURACY_THRESHOLD = 0.8
const FAST_SPEED_BONUS = 4
const FAST_SECONDS_PER_QUESTION = 20
const OK_SPEED_BONUS = 2
const OK_SECONDS_PER_QUESTION = 35

export interface CoinInputs {
  accuracy: number // 0..1, share of required questions correct on the first attempt
  avgSecondsPerQuestion: number
}

export function calculateCoinsEarned({ accuracy, avgSecondsPerQuestion }: CoinInputs): number {
  const accuracyBonus =
    accuracy >= 1 ? PERFECT_ACCURACY_BONUS : accuracy >= GOOD_ACCURACY_THRESHOLD ? GOOD_ACCURACY_BONUS : 0

  const speedBonus =
    avgSecondsPerQuestion <= FAST_SECONDS_PER_QUESTION
      ? FAST_SPEED_BONUS
      : avgSecondsPerQuestion <= OK_SECONDS_PER_QUESTION
        ? OK_SPEED_BONUS
        : 0

  return BASE_COINS + accuracyBonus + speedBonus
}
