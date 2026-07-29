import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createMultiMatcher } from '../match.ts'
import { MatcherResourceError } from './limits.ts'

describe('matcher resource limits', () => {
  it('enforces pattern source bytes below, at, and above the boundary', () => {
    let belowBoundary = createMultiMatcher({ limits: { maxPatternSourceBytes: 6 } })
    assert.doesNotThrow(() => belowBoundary.add('/a', null))

    let atBoundary = createMultiMatcher({ limits: { maxPatternSourceBytes: 6 } })
    assert.doesNotThrow(() => atBoundary.add('/abcde', null))

    let aboveBoundary = createMultiMatcher({ limits: { maxPatternSourceBytes: 6 } })
    assert.throws(
      () => aboveBoundary.add('/abcdef', null),
      resourceError('maxPatternSourceBytes', 6, 7),
    )
  })

  it('enforces pattern source bytes before parsing string patterns', () => {
    let matcher = createMultiMatcher({ limits: { maxPatternSourceBytes: 0 } })

    assert.throws(() => matcher.add('(', null), resourceError('maxPatternSourceBytes', 0, 1))
  })

  it('counts UTF-8 pattern source bytes without allocating an encoded copy', () => {
    let atBoundary = createMultiMatcher({ limits: { maxPatternSourceBytes: 5 } })
    assert.doesNotThrow(() => atBoundary.add('/💿', null))

    let aboveBoundary = createMultiMatcher({ limits: { maxPatternSourceBytes: 4 } })
    assert.throws(
      () => aboveBoundary.add('/💿', null),
      resourceError('maxPatternSourceBytes', 4, 5),
    )
  })

  it('enforces aggregate matcher source bytes below, at, and above the boundary', () => {
    let matcher = createMultiMatcher({ limits: { maxMatcherSourceBytes: 4 } })
    assert.doesNotThrow(() => matcher.add('/a', null))
    assert.doesNotThrow(() => matcher.add('/b', null))
    assert.throws(() => matcher.add('/c', null), resourceError('maxMatcherSourceBytes', 4, 6))
  })

  it('enforces aggregate matcher source bytes before parsing string patterns', () => {
    let matcher = createMultiMatcher({
      limits: { maxPatternSourceBytes: 1, maxMatcherSourceBytes: 0 },
    })

    assert.throws(() => matcher.add('(', null), resourceError('maxMatcherSourceBytes', 0, 1))
  })

  it('enforces aggregate compiled states below, at, and above the boundary', () => {
    let matcher = createMultiMatcher({ limits: { maxCompiledStates: 4 } })
    assert.doesNotThrow(() => matcher.add('/a', null))
    assert.doesNotThrow(() => matcher.add('/b', null))
    assert.throws(() => matcher.add('/c', null), resourceError('maxCompiledStates', 4, 6))
  })

  it('enforces aggregate capture metadata below, at, and above the boundary', () => {
    let matcher = createMultiMatcher({ limits: { maxCaptureMetadata: 2 } })
    assert.doesNotThrow(() => matcher.add('/:a', null))
    assert.doesNotThrow(() => matcher.add('/:b', null))
    assert.throws(() => matcher.add('/:c', null), resourceError('maxCaptureMetadata', 2, 3))
  })

  it('enforces active match states below, at, and above the boundary', () => {
    let belowBoundary = createMultiMatcher({ limits: { maxActiveStates: 11 } })
    belowBoundary.add('/a', null)
    assert.ok(belowBoundary.match('https://example.com/a'))

    let atBoundary = createMultiMatcher({ limits: { maxActiveStates: 10 } })
    atBoundary.add('/a', null)
    assert.ok(atBoundary.match('https://example.com/a'))

    let aboveBoundary = createMultiMatcher({ limits: { maxActiveStates: 9 } })
    aboveBoundary.add('/a', null)
    assert.throws(
      () => aboveBoundary.match('https://example.com/a'),
      resourceError('maxActiveStates', 9, 10),
    )
  })

  it('enforces active match states across all candidates', () => {
    let matcher = createMultiMatcher({ limits: { maxActiveStates: 17 } })
    matcher.add('/a', null)
    matcher.add('/a', null)

    assert.throws(
      () => matcher.match('https://example.com/a'),
      resourceError('maxActiveStates', 17, 18),
    )
  })

  it('enforces active match states before canonicalizing oversized URL input', () => {
    let matcher = createMultiMatcher({ limits: { maxActiveStates: 3 } })
    matcher.add('/*path', null)

    assert.throws(
      () => matcher.match('https://example.com/abcd'),
      resourceError('maxActiveStates', 3, 4),
    )
  })

  it('matches long deterministic patterns within the default active-state limit', () => {
    let value = 'a'.repeat(2_000)
    let matcher = createMultiMatcher()
    matcher.add(`/${value}`, null)

    assert.ok(matcher.match(`https://example.com/${value}`))
  })

  it('rejects invalid configured limits', () => {
    assert.throws(
      () => createMultiMatcher({ limits: { maxCompiledStates: -1 } }),
      new RangeError('maxCompiledStates must be a non-negative safe integer'),
    )
  })
})

function resourceError(
  limit: MatcherResourceError['details']['limit'],
  maximum: number,
  actual: number,
): MatcherResourceError {
  return new MatcherResourceError({ limit, maximum, actual })
}
