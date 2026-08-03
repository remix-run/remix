import { createMultiMatcher } from '@remix-run/route-pattern/match'
import { bench, describe } from 'vitest'

function createOptionalPattern(count: number): string {
  let pattern = '/root'
  for (let index = 0; index < count; index++) pattern += `(/segment-${index})`
  return pattern
}

function createOptionalUrl(count: number): URL {
  let pathname = '/root'
  for (let index = 0; index < count; index++) pathname += `/segment-${index}`
  return new URL(pathname, 'https://example.com')
}

function createWildcardPattern(count: number): string {
  let pattern = ''
  for (let index = 0; index < count; index++) pattern += `/*value${index}/marker-${index}`
  return `${pattern}/*tail/end`
}

function createWildcardNearMiss(count: number): URL {
  let pathname = ''
  for (let index = 0; index < count; index++) {
    pathname += `/value/${index === count - 1 ? 'missing' : `marker-${index}`}`
  }
  return new URL(`${pathname}/tail/end`, 'https://example.com')
}

for (let count of [8, 16, 32, 64]) {
  let pattern = createOptionalPattern(count)
  let url = createOptionalUrl(count)
  let matcher = createMultiMatcher()
  matcher.add(pattern, null)

  describe(`${count} independent optionals`, () => {
    bench('construct', () => {
      let instance = createMultiMatcher()
      instance.add(pattern, null)
    })

    bench('match', () => {
      matcher.match(url)
    })
  })
}

for (let count of [2, 4, 8, 16, 32]) {
  let matcher = createMultiMatcher()
  matcher.add(createWildcardPattern(count), null)
  let url = createWildcardNearMiss(count)

  bench(`${count} wildcard near miss`, () => {
    matcher.match(url)
  })
}

for (let count of [10, 100, 1000]) {
  let matcher = createMultiMatcher<number>()
  for (let index = 0; index < count; index++) matcher.add('/resource/:id', index)
  let url = new URL('https://example.com/resource/123')

  bench(`matchAll with ${count} equal patterns`, () => {
    matcher.matchAll(url)
  })
}
