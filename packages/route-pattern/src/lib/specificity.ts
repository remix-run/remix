import type { RoutePatternParts } from './route-pattern.ts'
import type { Match } from './match/types.ts'
import { decodeHostname } from './match/decode.ts'

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
export const ascending = (a: Match, b: Match): number => compare(a, b)

/**
 * Comparator function for sorting matches from most specific to least specific.
 *
 * @param a the first match to compare
 * @param b the second match to compare
 * @returns positive if `a` is less specific, negative if more specific, 0 if equal
 */
export const descending = (a: Match, b: Match): number => compare(a, b) * -1

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
  let aParts = a.pattern._parts
  let bParts = b.pattern._parts

  let protocolResult = compareProtocol(aParts.protocol, bParts.protocol)
  if (protocolResult !== 0) return protocolResult

  let portResult = comparePort(aParts.port, bParts.port)
  if (portResult !== 0) return portResult

  let hostnameResult = compareHostnameMeta(a.url, a.paramsMeta.hostname, b.paramsMeta.hostname)
  if (hostnameResult !== 0) return hostnameResult

  let pathnameResult = comparePathname(a.paramsMeta.pathname, b.paramsMeta.pathname)
  if (pathnameResult !== 0) return pathnameResult

  let searchResult = compareSearch(aParts.search, bParts.search)
  if (searchResult !== 0) return searchResult

  return 0
}

function compareProtocol(
  a: RoutePatternParts['protocol'],
  b: RoutePatternParts['protocol'],
): -1 | 0 | 1 {
  let aSpecificity = a === 'http' || a === 'https' ? 1 : 0
  let bSpecificity = b === 'http' || b === 'https' ? 1 : 0
  if (aSpecificity > bSpecificity) return 1
  if (aSpecificity < bSpecificity) return -1
  return 0
}

function comparePort(a: RoutePatternParts['port'], b: RoutePatternParts['port']): -1 | 0 | 1 {
  if (a !== null && b === null) return 1
  if (a === null && b !== null) return -1
  return 0
}

function compareHostnameMeta(
  url: URL,
  a: Match['paramsMeta']['hostname'],
  b: Match['paramsMeta']['hostname'],
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

  let hostname = decodeHostname(url.hostname)
  return compareHostnameRanges(hostname, a, b)
}

export function compareHostnameRanges(
  hostname: string,
  a: Match['paramsMeta']['hostname'],
  b: Match['paramsMeta']['hostname'],
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

  // Compare labels right-to-left, and characters within each label left-to-right.
  let segEnd = hostname.length
  while (segEnd >= 0) {
    let dot = segEnd === 0 ? -1 : hostname.lastIndexOf('.', segEnd - 1)
    let segBegin = dot + 1

    let cmp = compareRangeSlice(a, b, segBegin, segEnd)
    if (cmp !== 0) return cmp

    if (dot === -1) break
    segEnd = dot
  }

  return 0
}

function compareRangeSlice(
  a: Match['paramsMeta']['hostname'],
  b: Match['paramsMeta']['hostname'],
  segBegin: number,
  segEnd: number,
): -1 | 0 | 1 {
  if (segBegin >= segEnd) return 0

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
    let nextPos = nextA < nextB ? nextA : nextB
    if (nextPos > segEnd) nextPos = segEnd
    pos = nextPos
  }

  return 0
}

export function comparePathnameRanges(
  a: Match['paramsMeta']['pathname'],
  b: Match['paramsMeta']['pathname'],
): -1 | 0 | 1 {
  return comparePathname(a, b)
}

function comparePathname(
  a: Match['paramsMeta']['pathname'],
  b: Match['paramsMeta']['pathname'],
): -1 | 0 | 1 {
  if (a.length === 0 && b.length === 0) return 0
  if (a.length === 0) return 1
  if (b.length === 0) return -1

  let i = 0
  let aIndex = 0
  let bIndex = 0

  while (aIndex < a.length || bIndex < b.length) {
    let aRange = a[aIndex]
    let bRange = b[bIndex]

    if (aRange === undefined) return 1 // a is fully static from here
    if (bRange === undefined) return -1 // b is fully static from here

    // Skip to the minimum begin of the two current ranges
    i = aRange.begin < bRange.begin ? aRange.begin : bRange.begin

    if (i < aRange.begin) return 1 // a has static content at i
    if (i < bRange.begin) return -1 // b has static content at i

    if (aRange.type === ':' && bRange.type === '*') return 1 // a is more specific
    if (aRange.type === '*' && bRange.type === ':') return -1 // b is more specific

    i = aRange.end < bRange.end ? aRange.end : bRange.end

    // Advance range indices if we've reached their ends
    if (i >= aRange.end) aIndex += 1
    if (i >= bRange.end) bIndex += 1
  }

  return 0
}

function compareSearch(a: RoutePatternParts['search'], b: RoutePatternParts['search']): -1 | 0 | 1 {
  if (a.size === 0 && b.size === 0) return 0

  let aKeyValue = 0
  let aKey = 0
  for (let constraint of a.values()) {
    if (constraint.size === 0) aKey += 1
    else aKeyValue += constraint.size
  }

  let bKeyValue = 0
  let bKey = 0
  for (let constraint of b.values()) {
    if (constraint.size === 0) bKey += 1
    else bKeyValue += constraint.size
  }

  if (aKeyValue > bKeyValue) return 1
  if (aKeyValue < bKeyValue) return -1

  if (aKey > bKey) return 1
  if (aKey < bKey) return -1

  return 0
}
