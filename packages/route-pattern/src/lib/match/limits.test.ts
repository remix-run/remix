import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createMultiMatcher, MatcherResourceError } from '../match.ts'

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

  it('enforces aggregate matcher source bytes below, at, and above the boundary', () => {
    let matcher = createMultiMatcher({ limits: { maxMatcherSourceBytes: 4 } })
    assert.doesNotThrow(() => matcher.add('/a', null))
    assert.doesNotThrow(() => matcher.add('/b', null))
    assert.throws(() => matcher.add('/c', null), resourceError('maxMatcherSourceBytes', 4, 6))
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
    let belowBoundary = createMultiMatcher({ limits: { maxActiveStates: 5 } })
    belowBoundary.add('/a', null)
    assert.ok(belowBoundary.match('https://example.com/a'))

    let atBoundary = createMultiMatcher({ limits: { maxActiveStates: 4 } })
    atBoundary.add('/a', null)
    assert.ok(atBoundary.match('https://example.com/a'))

    let aboveBoundary = createMultiMatcher({ limits: { maxActiveStates: 3 } })
    aboveBoundary.add('/a', null)
    assert.throws(
      () => aboveBoundary.match('https://example.com/a'),
      resourceError('maxActiveStates', 3, 4),
    )
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
