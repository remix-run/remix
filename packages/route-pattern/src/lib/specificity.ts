/* eslint-disable jsdoc/require-param */

import type { RoutePattern, RoutePatternMatch } from './route-pattern.ts'

export function lessThan(a: RoutePatternMatch, b: RoutePatternMatch): boolean {
  return compare(a, b) === -1
}

export function greaterThan(a: RoutePatternMatch, b: RoutePatternMatch): boolean {
  return compare(a, b) === 1
}

export function equal(a: RoutePatternMatch, b: RoutePatternMatch): boolean {
  return compare(a, b) === 0
}

export let ascending = (a: RoutePatternMatch, b: RoutePatternMatch): number => compare(a, b)

export let descending = (a: RoutePatternMatch, b: RoutePatternMatch): number => compare(a, b) * -1

/**
 * Compare two matches by specificity.
 * Passing to `.sort()` will sort matches from least specific to most specific.
 *
 * @returns -1 if `a` is less specific, 1 if `a` is more specific, 0 if tied.
 */
export function compare(a: RoutePatternMatch, b: RoutePatternMatch): -1 | 0 | 1 {
  if (a.url.href !== b.url.href) {
    throw new Error(`Cannot compare matches for different URLs: ${a.url.href} vs ${b.url.href}`)
  }

  // Hostname comparison
  let hostnameResult = compareHostname(a.url.hostname, a.meta.hostname, b.meta.hostname)
  if (hostnameResult !== 0) return hostnameResult

  // Pathname comparison
  let pathnameResult = comparePathname(a.meta.pathname, b.meta.pathname)
  if (pathnameResult !== 0) return pathnameResult

  // Search comparison
  let searchResult = compareSearch(a.pattern.ast.search, b.pattern.ast.search)
  if (searchResult !== 0) return searchResult

  return 0
}

function compareHostname(
  hostname: string,
  a: RoutePatternMatch['meta']['hostname'],
  b: RoutePatternMatch['meta']['hostname'],
): -1 | 0 | 1 {
  if (a.length === 0 && b.length === 0) return 0
  if (a.length === 0 && b.length > 0) return 1
  if (a.length > 0 && b.length === 0) return -1

  // Encoding of hostname chars: 0 = static, 1 = variable (:), 2 = wildcard (*)
  // Note: `Int8Array` defaults to 0 for all indices not explicitly set.

  let aEncoding = new Int8Array(hostname.length)
  for (let range of a) {
    aEncoding.fill(range.type === ':' ? 1 : 2, range.begin, range.end)
  }

  let bEncoding = new Int8Array(hostname.length)
  for (let range of b) {
    bEncoding.fill(range.type === ':' ? 1 : 2, range.begin, range.end)
  }

  // Build segments right-to-left: desc order by begin
  let segments: Array<{ begin: number; end: number }> = []
  let end = hostname.length
  for (let i = hostname.length - 1; i >= 0; i--) {
    if (hostname[i] === '.') {
      segments.push({ begin: i + 1, end })
      end = i
    }
  }
  segments.push({ begin: 0, end }) // leftmost segment

  for (let segment of segments) {
    for (let j = segment.begin; j < segment.end; j++) {
      if (aEncoding[j] < bEncoding[j]) return 1 // a is more specific
      if (aEncoding[j] > bEncoding[j]) return -1 // b is more specific
    }
  }

  return 0
}

function comparePathname(
  a: RoutePatternMatch['meta']['pathname'],
  b: RoutePatternMatch['meta']['pathname'],
): -1 | 0 | 1 {
  if (a.length === 0 && b.length === 0) return 0
  if (a.length === 0 && b.length > 0) return 1
  if (a.length > 0 && b.length === 0) return -1

  let i = 0
  let aIndex = 0
  let bIndex = 0

  while (aIndex < a.length || bIndex < b.length) {
    let aRange = a[aIndex]
    let bRange = b[bIndex]

    if (aRange === undefined) return 1 // a is fully static from here
    if (bRange === undefined) return -1 // b is fully static from here

    // Skip to the minimum begin of the two current ranges
    i = Math.min(aRange.begin, bRange.begin)

    if (i < aRange.begin) return 1 // a has static content at i
    if (i < bRange.begin) return -1 // b has static content at i

    if (aRange.type === ':' && bRange.type === '*') return 1 // a is more specific
    if (aRange.type === '*' && bRange.type === ':') return -1 // b is more specific

    let minEnd = Math.min(aRange.end, bRange.end)
    i = minEnd

    // Advance range indices if we've reached their ends
    if (i >= aRange.end) aIndex += 1
    if (i >= bRange.end) bIndex += 1
  }

  return 0
}

function compareSearch(
  a: RoutePattern['ast']['search'],
  b: RoutePattern['ast']['search'],
): -1 | 0 | 1 {
  let aSpecificity = searchSpecificity(a)
  let bSpecificity = searchSpecificity(b)

  if (aSpecificity.keyAndExactValue > bSpecificity.keyAndExactValue) return 1
  if (aSpecificity.keyAndExactValue < bSpecificity.keyAndExactValue) return -1

  if (aSpecificity.keyAndAnyValue > bSpecificity.keyAndAnyValue) return 1
  if (aSpecificity.keyAndAnyValue < bSpecificity.keyAndAnyValue) return -1

  if (aSpecificity.key > bSpecificity.key) return 1
  if (aSpecificity.key < bSpecificity.key) return -1

  return 0
}

function searchSpecificity(constraints: RoutePattern['ast']['search']): {
  keyAndExactValue: number
  keyAndAnyValue: number
  key: number
} {
  let exactValue = 0
  let anyValue = 0
  let key = 0

  for (let constraint of constraints.values()) {
    if (constraint === null) {
      key += 1
      continue
    }
    if (constraint.size === 0) {
      anyValue += 1
      continue
    }
    exactValue += constraint.size
  }

  return { keyAndExactValue: exactValue, keyAndAnyValue: anyValue, key }
}
