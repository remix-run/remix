import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createMultiMatcher } from '../match.ts'
import { MatcherResourceError } from './limits.ts'

describe('matcher resource limits', () => {
  it('enforces pattern size below, at, and above the boundary', () => {
    let belowBoundary = createMultiMatcher({ limits: { maxPatternSize: 6 } })
    assert.doesNotThrow(() => belowBoundary.add('/a', null))

    let atBoundary = createMultiMatcher({ limits: { maxPatternSize: 6 } })
    assert.doesNotThrow(() => atBoundary.add('/abcde', null))

    let aboveBoundary = createMultiMatcher({ limits: { maxPatternSize: 6 } })
    assert.throws(() => aboveBoundary.add('/abcdef', null), resourceError('maxPatternSize', 6, 7))
  })

  it('enforces pattern size before parsing string patterns', () => {
    let matcher = createMultiMatcher({ limits: { maxPatternSize: 0 } })

    assert.throws(() => matcher.add('(', null), resourceError('maxPatternSize', 0, 1))
  })

  it('measures UTF-8 pattern size without allocating an encoded copy', () => {
    let atBoundary = createMultiMatcher({ limits: { maxPatternSize: 5 } })
    assert.doesNotThrow(() => atBoundary.add('/💿', null))

    let aboveBoundary = createMultiMatcher({ limits: { maxPatternSize: 4 } })
    assert.throws(() => aboveBoundary.add('/💿', null), resourceError('maxPatternSize', 4, 5))
  })

  it('enforces matcher size below, at, and above the boundary', () => {
    let matcher = createMultiMatcher({ limits: { maxMatcherSize: 4 } })
    assert.doesNotThrow(() => matcher.add('/a', null))
    assert.doesNotThrow(() => matcher.add('/b', null))
    assert.throws(() => matcher.add('/c', null), resourceError('maxMatcherSize', 4, 6))
  })

  it('enforces matcher size before parsing string patterns', () => {
    let matcher = createMultiMatcher({
      limits: { maxPatternSize: 1, maxMatcherSize: 0 },
    })

    assert.throws(() => matcher.add('(', null), resourceError('maxMatcherSize', 0, 1))
  })

  it('enforces match work below, at, and above the boundary', () => {
    let belowBoundary = createMultiMatcher({ limits: { maxMatchWork: 11 } })
    belowBoundary.add('/a', null)
    assert.ok(belowBoundary.match('https://example.com/a'))

    let atBoundary = createMultiMatcher({ limits: { maxMatchWork: 10 } })
    atBoundary.add('/a', null)
    assert.ok(atBoundary.match('https://example.com/a'))

    let aboveBoundary = createMultiMatcher({ limits: { maxMatchWork: 9 } })
    aboveBoundary.add('/a', null)
    assert.throws(
      () => aboveBoundary.match('https://example.com/a'),
      resourceError('maxMatchWork', 9, 10),
    )
  })

  it('enforces match work across all candidates', () => {
    let matcher = createMultiMatcher({ limits: { maxMatchWork: 17 } })
    matcher.add('/a', null)
    matcher.add('/a', null)

    assert.throws(
      () => matcher.match('https://example.com/a'),
      resourceError('maxMatchWork', 17, 18),
    )
  })

  it('enforces match work before canonicalizing oversized URL input', () => {
    let matcher = createMultiMatcher({ limits: { maxMatchWork: 3 } })
    matcher.add('/*path', null)

    assert.throws(
      () => matcher.match('https://example.com/abcd'),
      resourceError('maxMatchWork', 3, 4),
    )
  })

  it('matches long deterministic patterns within the default match-work limit', () => {
    let value = 'a'.repeat(2_000)
    let matcher = createMultiMatcher()
    matcher.add(`/${value}`, null)

    assert.ok(matcher.match(`https://example.com/${value}`))
  })

  it('enforces match work while scanning optional pathname variables', () => {
    let matcher = createMultiMatcher({ limits: { maxMatchWork: 1_000 } })
    matcher.add('/:name(.:extension)', null)

    assert.throws(
      () => matcher.match(`https://example.com/${'a'.repeat(128)}`),
      exceedsMatchWork(1_000),
    )
  })

  it('enforces match work while scanning optional hostname variables', () => {
    let matcher = createMultiMatcher({ limits: { maxMatchWork: 2_000 } })
    matcher.add('://:tenant(.:region).example.com/', null)

    assert.throws(
      () => matcher.match(`https://${'a'.repeat(64)}.example.com/`),
      exceedsMatchWork(2_000),
    )
  })

  it('enforces match work while comparing pathname wildcard captures', () => {
    let matcher = createMultiMatcher({ limits: { maxMatchWork: 1_000 } })
    matcher.add('/*first(/*rest)', null)

    assert.throws(
      () => matcher.match(`https://example.com/${'a/'.repeat(30)}a`),
      exceedsMatchWork(1_000),
    )
  })

  it('enforces match work while comparing hostname wildcard captures', () => {
    let matcher = createMultiMatcher({ limits: { maxMatchWork: 1_000 } })
    matcher.add('://*tenant(.*region).example.com/', null)

    assert.throws(
      () => matcher.match(`https://${'a.'.repeat(12)}a.example.com/`),
      exceedsMatchWork(1_000),
    )
  })

  it('matches long linear variables within a small match-work limit', () => {
    let matcher = createMultiMatcher({ limits: { maxMatchWork: 1_000 } })
    matcher.add('/:name', null)
    let name = 'a'.repeat(128)

    assert.deepEqual(matcher.match(`https://example.com/${name}`)?.params, { name })
  })

  it('rejects invalid configured limits', () => {
    assert.throws(
      () => createMultiMatcher({ limits: { maxMatcherSize: -1 } }),
      new RangeError('maxMatcherSize must be a non-negative safe integer'),
    )
  })
})

function exceedsMatchWork(maximum: number) {
  return (error: unknown) =>
    error instanceof MatcherResourceError &&
    error.details.limit === 'maxMatchWork' &&
    error.details.maximum === maximum &&
    error.details.actual > maximum
}

function resourceError(
  limit: MatcherResourceError['details']['limit'],
  maximum: number,
  actual: number,
): MatcherResourceError {
  return new MatcherResourceError({ limit, maximum, actual })
}
