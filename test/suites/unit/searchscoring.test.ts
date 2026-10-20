import { describe, expect, it } from 'vitest'

import type { CppSearchScoringReciprocalRankFusion } from '../../../lib/binding'
import { searchScoringToCpp } from '../../../lib/bindingutilities'
import { InvalidArgumentError } from '../../../lib/errors'
import {
  SearchScoring,
  SearchScoringNone,
  SearchScoringReciprocalRankFusion,
  SearchScoringRelativeScoreFusion,
} from '../../../lib/searchtypes'

// No server needed: these check the search scoring classes and what
// `searchScoringToCpp` hands the binding.

function rrfValue(scoring: SearchScoringReciprocalRankFusion) {
  return searchScoringToCpp(scoring)
    .scoring_value as CppSearchScoringReciprocalRankFusion
}

describe('#searchscoring', () => {
  it('should construct SearchScoringNone', () => {
    const scoring = new SearchScoringNone()
    expect(scoring).toBeInstanceOf(SearchScoring)
    expect(SearchScoring.modeOf(scoring)).toBe('none')
  })

  it('should construct SearchScoringNone via the static factory', () => {
    const scoring = SearchScoring.none()
    expect(scoring).toBeInstanceOf(SearchScoringNone)
    expect(SearchScoring.modeOf(scoring)).toBe('none')
  })

  it('should construct SearchScoringReciprocalRankFusion with defaults', () => {
    const scoring = new SearchScoringReciprocalRankFusion()
    expect(SearchScoring.modeOf(scoring)).toBe('rrf')
    expect(scoring.rankConstant).toBeUndefined()
    expect(scoring.windowSize).toBeUndefined()
  })

  it('should construct SearchScoringReciprocalRankFusion with options', () => {
    const scoring = new SearchScoringReciprocalRankFusion({
      rankConstant: 60,
      windowSize: 100,
    })
    expect(SearchScoring.modeOf(scoring)).toBe('rrf')
    expect(scoring.rankConstant).toBe(60)
    expect(scoring.windowSize).toBe(100)
  })

  it('should construct SearchScoringReciprocalRankFusion via the static factory', () => {
    const scoring = SearchScoring.reciprocalRankFusion({
      rankConstant: 60,
      windowSize: 100,
    })
    expect(scoring).toBeInstanceOf(SearchScoringReciprocalRankFusion)
    expect(SearchScoring.modeOf(scoring)).toBe('rrf')
    expect(scoring.rankConstant).toBe(60)
    expect(scoring.windowSize).toBe(100)
  })

  it('should construct SearchScoringRelativeScoreFusion with defaults', () => {
    const scoring = new SearchScoringRelativeScoreFusion()
    expect(SearchScoring.modeOf(scoring)).toBe('rsf')
    expect(scoring.windowSize).toBeUndefined()
  })

  it('should construct SearchScoringRelativeScoreFusion with options', () => {
    const scoring = new SearchScoringRelativeScoreFusion({ windowSize: 100 })
    expect(SearchScoring.modeOf(scoring)).toBe('rsf')
    expect(scoring.windowSize).toBe(100)
  })

  it('should construct SearchScoringRelativeScoreFusion via the static factory', () => {
    const scoring = SearchScoring.relativeScoreFusion({ windowSize: 100 })
    expect(scoring).toBeInstanceOf(SearchScoringRelativeScoreFusion)
    expect(SearchScoring.modeOf(scoring)).toBe('rsf')
    expect(scoring.windowSize).toBe(100)
  })

  it('should pass valid uint32 rankConstant/windowSize through to the cpp request', () => {
    const scoringValue = rrfValue(
      new SearchScoringReciprocalRankFusion({
        rankConstant: 60,
        windowSize: 4294967295,
      })
    )
    expect(scoringValue.rank_constant).toBe(60)
    expect(scoringValue.window_size).toBe(4294967295)
  })

  it('should leave undefined rankConstant/windowSize as undefined', () => {
    const scoringValue = rrfValue(new SearchScoringReciprocalRankFusion())
    expect(scoringValue.rank_constant).toBeUndefined()
    expect(scoringValue.window_size).toBeUndefined()
  })

  it('should reject a negative rankConstant', () => {
    expect(() =>
      searchScoringToCpp(
        new SearchScoringReciprocalRankFusion({ rankConstant: -1 })
      )
    ).toThrow(InvalidArgumentError)
  })

  it('should reject a non-integer windowSize', () => {
    expect(() =>
      searchScoringToCpp(
        new SearchScoringRelativeScoreFusion({ windowSize: 1.5 })
      )
    ).toThrow(InvalidArgumentError)
  })

  it('should reject a windowSize larger than uint32 max', () => {
    expect(() =>
      searchScoringToCpp(
        new SearchScoringRelativeScoreFusion({ windowSize: 4294967296 })
      )
    ).toThrow(InvalidArgumentError)
  })
})
