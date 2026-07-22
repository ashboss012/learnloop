import { describe, test, expect } from 'vitest'
import { fleschKincaidGradeLevel, inReadingLevelBand, READING_LEVEL_BAND } from '@/lib/readability'

describe('fleschKincaidGradeLevel', () => {
  test('a trivially simple sentence scores low', () => {
    const score = fleschKincaidGradeLevel('The cat sat on the mat. The dog ran to the park.')
    expect(score).toBeLessThan(2)
  })

  test('a real 4th-grade-style paragraph lands inside the reading level band', () => {
    const passage = `
      Maya loved to visit the library on Saturdays. She and her dad walked
      down the quiet street. They opened the big wooden doors and went
      inside. Tall shelves held many books about animals and faraway
      places. Maya always picked a new adventure story to read before bed.
    `
    const score = fleschKincaidGradeLevel(passage)
    expect(inReadingLevelBand(score)).toBe(true)
  })

  test('dense technical text scores well above the band', () => {
    const passage = `
      Photosynthesis is the biochemical process through which autotrophic
      organisms convert electromagnetic radiation into chemical energy,
      utilizing chlorophyll-containing organelles to catalyze the
      transformation of atmospheric carbon dioxide and water into
      carbohydrates and molecular oxygen through a series of interdependent
      enzymatic reactions.
    `
    const score = fleschKincaidGradeLevel(passage)
    expect(score).toBeGreaterThan(READING_LEVEL_BAND[1])
  })

  test('empty text does not throw and scores 0', () => {
    expect(fleschKincaidGradeLevel('')).toBe(0)
  })
})

describe('inReadingLevelBand', () => {
  test('boundaries are inclusive', () => {
    expect(inReadingLevelBand(READING_LEVEL_BAND[0])).toBe(true)
    expect(inReadingLevelBand(READING_LEVEL_BAND[1])).toBe(true)
  })

  test('outside the band on either side is false', () => {
    expect(inReadingLevelBand(READING_LEVEL_BAND[0] - 0.1)).toBe(false)
    expect(inReadingLevelBand(READING_LEVEL_BAND[1] + 0.1)).toBe(false)
  })
})
