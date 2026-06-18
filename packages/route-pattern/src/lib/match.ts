import { RoutePattern } from './route-pattern.ts'
import { parsePattern } from './route-pattern/parse.ts'

import { Trie } from './match/trie.ts'
import type { Match } from './match/types.ts'
import * as Specificity from './specificity.ts'

/** Options that control route pattern matching. */
export type MatcherOptions = {
  /**
   * When `true`, pathname matching is case-insensitive for all patterns. Hostname is always
   * case-insensitive; search remains case-sensitive. Defaults to `false`.
   */
  ignoreCase?: boolean
}

/** Matcher for a single route pattern. */
export type Matcher<source extends string = string> = {
  /** Most specific match for `url`, or `null` when the URL does not match this pattern. */
  match(url: string | URL): Match<source, undefined> | null
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
  pattern = typeof pattern === 'string' ? RoutePattern.parse(pattern) : pattern
  let matcher = createMultiMatcher<undefined>(options)
  matcher.add(pattern, undefined)

  return {
    match(url: string | URL): Match<source, undefined> | null {
      return matcher.match(url) as Match<source, undefined> | null
    },
  }
}

/** Matcher for a collection of route patterns with optional attached data. */
export type MultiMatcher<data = unknown> = {
  /** Whether pathname matching is case-insensitive. */
  readonly ignoreCase: boolean

  /** Add a route pattern with data that is returned when the pattern matches. */
  add(pattern: string | RoutePattern, data: data): void

  /** Most specific match for `url`, or `null` when nothing matches. */
  match(url: string | URL): Match<string, data> | null

  /** Every match for `url`, sorted from most to least specific. */
  matchAll(url: string | URL): Array<Match<string, data>>
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
    this.ignoreCase = options?.ignoreCase ?? false
    this.#trie = new Trie<data>({ ignoreCase: this.ignoreCase })
  }

  add(pattern: string | RoutePattern, data: data): void {
    pattern = typeof pattern === 'string' ? parsePattern(pattern) : pattern
    this.#trie.insert(pattern, data)
  }

  match(url: string | URL): Match<string, data> | null {
    let parsedUrl = typeof url === 'string' ? new URL(url) : url
    let best: Match<string, data> | null = null
    for (let match of this.#trie.search(parsedUrl)) {
      if (best === null || Specificity.greaterThan(match, best)) {
        best = match
      }
    }
    return best
  }

  matchAll(url: string | URL): Array<Match<string, data>> {
    let parsedUrl = typeof url === 'string' ? new URL(url) : url
    let matches: Array<Match<string, data>> = []
    for (let match of this.#trie.search(parsedUrl)) {
      matches.push(match)
    }
    return matches.sort(Specificity.descending)
  }
}
