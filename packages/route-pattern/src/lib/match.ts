import type { RoutePattern } from './route-pattern.ts'

import { Trie } from './match/trie.ts'
import type { Match } from './match/types.ts'
import type { MatcherLimits } from './match/limits.ts'

/** Options that control route pattern matching. */
export interface MatcherOptions {
  /**
   * When `true`, pathname matching is case-insensitive for all patterns. Hostname is always
   * case-insensitive; search remains case-sensitive. Defaults to `false`.
   */
  ignoreCase?: boolean

  /** Overrides for pattern-compilation and URL-matching resource limits. */
  limits?: Partial<MatcherLimits>

  /**
   * When `true`, matches compute `url` and `paramsMeta` the first time they are read, and URL
   * strings that are already in the form `URL` serializes to, such as `request.url`, are matched
   * without being parsed. This makes matching faster when you only read `params` or `data`.
   *
   * Lazy matches are class instances whose `url` and `paramsMeta` are getters, so spreading a match
   * or passing it to `JSON.stringify()` leaves them out. Defaults to `false`.
   */
  lazyMatches?: boolean
}

/** Options that control how a URL string is resolved before matching. */
export interface MatchOptions {
  /** Absolute URL used to resolve relative URL strings with platform `URL` semantics. */
  baseURL?: string | URL
}

/** Matcher for a single route pattern. */
export type Matcher<source extends string = string> = {
  /** Most specific match for `url`, or `null` when the URL does not match this pattern. */
  match(url: string | URL, options?: MatchOptions): Match<source, undefined> | null
}

/**
 * Create a matcher for a single route pattern.
 *
 * @param pattern The route pattern to match against
 * @param options Options for matching URLs
 * @returns A matcher for the given pattern
 */
export function createMatcher<source extends string>(
  pattern: source | RoutePattern<source>,
  options?: MatcherOptions,
): Matcher<source> {
  let matcher = createMultiMatcher<undefined>(options)
  matcher.add(pattern, undefined)

  return {
    match: (url, matchOptions) =>
      matcher.match(url, matchOptions) as Match<source, undefined> | null,
  }
}

/** Matcher for a collection of route patterns with optional attached data. */
export type MultiMatcher<data = unknown> = {
  /** Whether pathname matching is case-insensitive. */
  readonly ignoreCase: boolean

  /** Add a route pattern with data that is returned when the pattern matches. */
  add(pattern: string | RoutePattern, data: data): void

  /** Most specific match for `url`, or `null` when nothing matches. */
  match(url: string | URL, options?: MatchOptions): Match<string, data> | null

  /** Every match for `url`, sorted from most to least specific. */
  matchAll(url: string | URL, options?: MatchOptions): Array<Match<string, data>>
}

/**
 * Create a matcher for multiple route patterns.
 *
 * @param options Options for matching URLs
 * @returns A matcher that can register multiple patterns with associated data
 */
export function createMultiMatcher<data = unknown>(options?: MatcherOptions): MultiMatcher<data> {
  return new TrieMatcher<data>(options)
}

class TrieMatcher<data = unknown> implements MultiMatcher<data> {
  readonly ignoreCase: boolean
  #trie: Trie<data>

  constructor(options?: MatcherOptions) {
    this.#trie = new Trie<data>(options)
    this.ignoreCase = this.#trie.ignoreCase
  }

  add(pattern: string | RoutePattern, data: data): void {
    this.#trie.insert(pattern, data)
  }

  match(url: string | URL, options?: MatchOptions): Match<string, data> | null {
    return this.#trie.matchBest(this.#resolveURL(url, options))
  }

  matchAll(url: string | URL, options?: MatchOptions): Array<Match<string, data>> {
    return this.#trie.searchAll(this.#resolveURL(url, options))
  }

  #resolveURL(url: string | URL, options?: MatchOptions): URL | SerializedURL {
    if (typeof url !== 'string') return url
    if (options?.baseURL !== undefined) return new URL(url, new URL(options.baseURL))
    // Eager matches need a `URL` anyway, so only lazy matchers skip parsing.
    return (this.#trie.lazyMatches ? parseSerializedURL(url) : null) ?? new URL(url)
  }
}

/**
 * The URL fields that matching reads, taken from a string that is already in the form `URL`
 * serializes to, such as `request.url`. Matching it skips parsing the string into a `URL`, which is
 * created only if a caller reads `match.url`.
 */
export class SerializedURL {
  readonly href: string
  readonly protocol: 'http:' | 'https:'
  readonly port: string
  readonly pathname: string
  #hostStart: number
  #hostEnd: number
  #searchStart: number
  #searchEnd: number
  #url: URL | undefined
  #searchParams: URLSearchParams | undefined

  constructor(
    href: string,
    protocol: 'http:' | 'https:',
    hostStart: number,
    hostEnd: number,
    port: string,
    pathname: string,
    searchStart: number,
    searchEnd: number,
  ) {
    this.href = href
    this.protocol = protocol
    this.#hostStart = hostStart
    this.#hostEnd = hostEnd
    this.port = port
    this.pathname = pathname
    this.#searchStart = searchStart
    this.#searchEnd = searchEnd
  }

  get hostname(): string {
    return this.href.slice(this.#hostStart, this.#hostEnd)
  }

  get search(): string {
    return this.href.slice(this.#searchStart, this.#searchEnd)
  }

  get searchParams(): URLSearchParams {
    return (this.#searchParams ??= new URLSearchParams(this.search))
  }

  toURL(): URL {
    return (this.#url ??= new URL(this.href))
  }
}

const HOST_CHAR = 1
const PATH_CHAR = 2
const QUERY_CHAR = 4

// Classes of the ASCII characters that can appear verbatim in each part of a serialized URL. Path
// and query characters exclude anything `URL` would percent-encode, plus a few it leaves alone, to
// keep the check simple.
const serializedCharClasses = new Uint8Array(128)
for (let code = 0x21; code < 0x7f; code++) {
  if ('"#<>\\^`{|}'.includes(String.fromCharCode(code))) continue
  serializedCharClasses[code] = code === 0x3f /* ? */ ? QUERY_CHAR : PATH_CHAR | QUERY_CHAR
}
serializedCharClasses[0x27 /* ' */] = PATH_CHAR
for (let char of 'abcdefghijklmnopqrstuvwxyz0123456789-') {
  serializedCharClasses[char.charCodeAt(0)] |= HOST_CHAR
}

// Splits an absolute `http:` or `https:` URL string into its parts when the string is already in
// serialized form, so `new URL(href)` would produce the same parts. Returns `null` for anything that
// `URL` might normalize, such as uppercase or non-ASCII hostnames, IP addresses, default or
// zero-padded ports, dot segments, or characters that `URL` would percent-encode.
function parseSerializedURL(href: string): SerializedURL | null {
  // Char code comparisons are noticeably faster than `startsWith()` on this hot path.
  if (
    href.charCodeAt(0) !== 0x68 /* h */ ||
    href.charCodeAt(1) !== 0x74 /* t */ ||
    href.charCodeAt(2) !== 0x74 /* t */ ||
    href.charCodeAt(3) !== 0x70 /* p */
  ) {
    return null
  }
  let protocol: 'http:' | 'https:' = 'http:'
  let index = 4
  if (href.charCodeAt(index) === 0x73 /* s */) {
    protocol = 'https:'
    index++
  }
  if (
    href.charCodeAt(index) !== 0x3a /* : */ ||
    href.charCodeAt(index + 1) !== 0x2f /* / */ ||
    href.charCodeAt(index + 2) !== 0x2f /* / */
  ) {
    return null
  }
  index += 3

  let length = href.length
  let hostStart = index
  let labelStart = index
  let code = -1
  for (; index < length; index++) {
    code = href.charCodeAt(index)
    if (code === 0x2e /* . */) {
      if (index === labelStart) return null
      labelStart = index + 1
    } else if (code > 0x7f || (serializedCharClasses[code] & HOST_CHAR) === 0) {
      break
    } else if (index === labelStart && code === 0x78 /* x */ && href.startsWith('xn--', index)) {
      // `xn--` labels must be valid Punycode
      return null
    }
  }
  let hostEnd = index
  if (hostEnd === labelStart) return null
  // `URL` parses a hostname whose last label starts with a digit as an IPv4 address
  let labelCode = href.charCodeAt(labelStart)
  if (labelCode >= 0x30 && labelCode <= 0x39) return null

  let port = ''
  if (code === 0x3a /* : */) {
    let portStart = ++index
    for (; index < length; index++) {
      code = href.charCodeAt(index)
      if (code < 0x30 || code > 0x39) break
    }
    port = href.slice(portStart, index)
    if (port === '' || port.length > 5 || port.charCodeAt(0) === 0x30 || Number(port) > 65535) {
      return null
    }
    if (port === (protocol === 'https:' ? '443' : '80')) return null
  }
  if (index === length || code !== 0x2f /* / */) return null

  let pathStart = index
  for (; index < length; index++) {
    code = href.charCodeAt(index)
    if (code === 0x2f /* / */) {
      // `URL` resolves dot segments, including percent-encoded ones such as `%2e`.
      let next = href.charCodeAt(index + 1)
      if (next === 0x2e) return null
      if (next === 0x25 && href.charCodeAt(index + 2) === 0x32) {
        if ((href.charCodeAt(index + 3) | 0x20) === 0x65 /* e */) return null
      }
    } else if (code > 0x7f || (serializedCharClasses[code] & PATH_CHAR) === 0) {
      break
    }
  }
  let pathname = href.slice(pathStart, index)

  let searchStart = index
  if (index < length && code === 0x3f /* ? */) {
    for (index++; index < length; index++) {
      code = href.charCodeAt(index)
      if (code > 0x7f || (serializedCharClasses[code] & QUERY_CHAR) === 0) break
    }
  }
  let searchEnd = index
  // `URL.search` is empty for a URL that ends with `?`.
  if (searchEnd === searchStart + 1) searchEnd = searchStart
  if (index < length && code !== 0x23 /* # */) return null

  return new SerializedURL(
    href,
    protocol,
    hostStart,
    hostEnd,
    port,
    pathname,
    searchStart,
    searchEnd,
  )
}
