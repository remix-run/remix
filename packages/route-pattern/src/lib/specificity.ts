import type { RoutePatternParts } from './route-pattern.ts'
import type { Match } from './match/types.ts'
import { decodeHostname } from './match/punycode.ts'

type Ranges = ReadonlyArray<Match['paramsMeta']['pathname'][number]>

/**
 * Returns true if match `a` is less specific than match `b`.
 *
 * @param a the first match to compare
 * @param b the second match to compare
 * @returns true if `a` is less specific than `b`
 */
export function lessThan(a: Match, b: Match): boolean {
  return compare(a, b) === -1
}

/**
 * Returns true if match `a` is more specific than match `b`.
 *
 * @param a the first match to compare
 * @param b the second match to compare
 * @returns true if `a` is more specific than `b`
 */
export function greaterThan(a: Match, b: Match): boolean {
  return compare(a, b) === 1
}

/**
 * Returns true if matches `a` and `b` have equal specificity.
 *
 * @param a the first match to compare
 * @param b the second match to compare
 * @returns true if `a` and `b` have equal specificity
 */
export function equal(a: Match, b: Match): boolean {
  return compare(a, b) === 0
}

/**
 * Comparator function for sorting matches from least specific to most specific.
 *
 * @param a the first match to compare
 * @param b the second match to compare
 * @returns negative if `a` is less specific, positive if more specific, 0 if equal
 */
export function ascending(a: Match, b: Match): number {
  return compare(a, b)
}

/**
 * Comparator function for sorting matches from most specific to least specific.
 *
 * @param a the first match to compare
 * @param b the second match to compare
 * @returns positive if `a` is less specific, negative if more specific, 0 if equal
 */
export function descending(a: Match, b: Match): number {
  return compare(a, b) * -1
}

/**
 * Compare two matches by specificity.
 * Passing to `.sort()` will sort matches from least specific to most specific.
 *
 * @param a the first match to compare
 * @param b the second match to compare
 * @returns -1 if `a` is less specific, 1 if `a` is more specific, 0 if tied.
 */
export function compare(a: Match, b: Match): -1 | 0 | 1 {
  if (a.url !== b.url && a.url.href !== b.url.href) {
    throw new Error(`Cannot compare matches for different URLs: ${a.url.href} vs ${b.url.href}`)
  }
  return compareSameURL(a, b, () => decodeHostname(a.url.hostname))
}

// Compares two matches for the same URL without reading `match.url`, which is created lazily for
// string URLs.
export function compareSameURL(a: Match, b: Match, getHostname: () => string): -1 | 0 | 1 {
  let aParts = a.pattern._parts
  let bParts = b.pattern._parts

  return (
    compareProtocol(aParts.protocol, bParts.protocol) ||
    comparePort(aParts.port, bParts.port) ||
    compareHostnameRanges(a.paramsMeta.hostname, b.paramsMeta.hostname, getHostname) ||
    comparePathnameRanges(a.paramsMeta.pathname, b.paramsMeta.pathname) ||
    compareSearch(aParts.search, bParts.search)
  )
}

function compareProtocol(
  a: RoutePatternParts['protocol'],
  b: RoutePatternParts['protocol'],
): -1 | 0 | 1 {
  let aSpec = a === 'http' || a === 'https' ? 1 : 0
  let bSpec = b === 'http' || b === 'https' ? 1 : 0
  return aSpec > bSpec ? 1 : aSpec < bSpec ? -1 : 0
}

function comparePort(a: RoutePatternParts['port'], b: RoutePatternParts['port']): -1 | 0 | 1 {
  if (a !== null && b === null) return 1
  if (a === null && b !== null) return -1
  return 0
}

export function compareHostnameRanges(
  a: Ranges,
  b: Ranges,
  hostnameOrGetter: string | (() => string),
): -1 | 0 | 1 {
  if (a.length === 0 && b.length === 0) return 0
  if (a.length === 0) return 1
  if (b.length === 0) return -1
  if (
    a.length === 1 &&
    b.length === 1 &&
    a[0].type === b[0].type &&
    a[0].begin === b[0].begin &&
    a[0].end === b[0].end
  ) {
    return 0
  }

  let hostname = typeof hostnameOrGetter === 'string' ? hostnameOrGetter : hostnameOrGetter()

  // Compare labels right-to-left, and characters within each label left-to-right.
  let segEnd = hostname.length
  while (true) {
    let dot = segEnd === 0 ? -1 : hostname.lastIndexOf('.', segEnd - 1)
    let cmp = compareRangeSlice(a, b, dot + 1, segEnd)
    if (cmp !== 0) return cmp
    if (dot === -1) return 0
    segEnd = dot
  }
}

function compareRangeSlice(a: Ranges, b: Ranges, segBegin: number, segEnd: number): -1 | 0 | 1 {
  let aIndex = 0
  let bIndex = 0
  let pos = segBegin

  while (pos < segEnd) {
    while (aIndex < a.length && (a[aIndex].end <= pos || a[aIndex].begin === a[aIndex].end)) {
      aIndex += 1
    }
    while (bIndex < b.length && (b[bIndex].end <= pos || b[bIndex].begin === b[bIndex].end)) {
      bIndex += 1
    }

    let aRange = aIndex < a.length && a[aIndex].begin < segEnd ? a[aIndex] : undefined
    let bRange = bIndex < b.length && b[bIndex].begin < segEnd ? b[bIndex] : undefined

    if (aRange === undefined && bRange === undefined) return 0

    let aActive = aRange !== undefined && aRange.begin <= pos
    let bActive = bRange !== undefined && bRange.begin <= pos

    let aSpec = aActive ? (aRange!.type === ':' ? 1 : 2) : 0
    let bSpec = bActive ? (bRange!.type === ':' ? 1 : 2) : 0
    if (aSpec < bSpec) return 1
    if (aSpec > bSpec) return -1

    let nextA = aRange === undefined ? segEnd : aActive ? aRange.end : aRange.begin
    let nextB = bRange === undefined ? segEnd : bActive ? bRange.end : bRange.begin
    pos = nextA < nextB ? nextA : nextB
  }

  return 0
}

export function comparePathnameRanges(a: Ranges, b: Ranges): -1 | 0 | 1 {
  let aIndex = 0
  let bIndex = 0

  while (aIndex < a.length || bIndex < b.length) {
    let aRange = a[aIndex]
    let bRange = b[bIndex]

    if (aRange === undefined) return 1
    if (bRange === undefined) return -1

    let i = aRange.begin < bRange.begin ? aRange.begin : bRange.begin

    if (i < aRange.begin) return 1
    if (i < bRange.begin) return -1

    if (aRange.type === ':' && bRange.type === '*') return 1
    if (aRange.type === '*' && bRange.type === ':') return -1

    i = aRange.end < bRange.end ? aRange.end : bRange.end

    if (i >= aRange.end) aIndex += 1
    if (i >= bRange.end) bIndex += 1
  }

  return 0
}

function countSearch(search: RoutePatternParts['search']): [keyValue: number, keyOnly: number] {
  let keyValue = 0
  let keyOnly = 0
  for (let constraint of search.values()) {
    if (constraint.size === 0) keyOnly += 1
    else keyValue += constraint.size
  }
  return [keyValue, keyOnly]
}

function compareSearch(a: RoutePatternParts['search'], b: RoutePatternParts['search']): -1 | 0 | 1 {
  if (a.size === 0 && b.size === 0) return 0
  let [aKeyValue, aKey] = countSearch(a)
  let [bKeyValue, bKey] = countSearch(b)

  if (aKeyValue !== bKeyValue) return aKeyValue > bKeyValue ? 1 : -1
  if (aKey !== bKey) return aKey > bKey ? 1 : -1
  return 0
}
