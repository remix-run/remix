import type { RoutePatternAST } from './ast.ts'
import { parsePattern } from './parse.ts'

import { Trie } from './matcher/trie.ts'
import type { Match } from './matcher/types.ts'
import * as Specificity from './specificity.ts'

export type RoutePatternMatch<data = unknown> = Match<data> & { url: URL }

export type RoutePatternMatcher<data = unknown> = {
  readonly ignoreCase: boolean
  add(pattern: string | RoutePatternAST, data: data): void
  /** Most specific match for `url`, or `null` when nothing matches. */
  match(url: string | URL): RoutePatternMatch<data> | null
  /** Every match for `url`, sorted from most to least specific. */
  matchAll(url: string | URL): Array<RoutePatternMatch<data>>
}

export type RoutePatternMatcherOptions = {
  /**
   * When `true`, pathname matching is case-insensitive for all patterns. Hostname is always
   * case-insensitive; search remains case-sensitive. Defaults to `false`.
   */
  ignoreCase?: boolean
}

export function createPatternMatcher<data = unknown>(
  options?: RoutePatternMatcherOptions,
): RoutePatternMatcher<data> {
  return new TrieMatcher<data>(options)
}

class TrieMatcher<data = unknown> implements RoutePatternMatcher<data> {
  readonly ignoreCase: boolean
  #trie: Trie<data>

  constructor(options?: RoutePatternMatcherOptions) {
    this.ignoreCase = options?.ignoreCase ?? false
    this.#trie = new Trie<data>({ ignoreCase: this.ignoreCase })
  }

  add(pattern: string | RoutePatternAST, data: data): void {
    let ast = typeof pattern === 'string' ? parsePattern(pattern) : pattern
    this.#trie.insert(ast, data)
  }

  match(url: string | URL): RoutePatternMatch<data> | null {
    let parsedUrl = typeof url === 'string' ? new URL(url) : url
    let best: RoutePatternMatch<data> | null = null
    for (let match of this.#trie.search(parsedUrl)) {
      let candidate = toMatch(match, parsedUrl)
      if (best === null || Specificity.greaterThan(candidate, best)) {
        best = candidate
      }
    }
    return best
  }

  matchAll(url: string | URL): Array<RoutePatternMatch<data>> {
    let parsedUrl = typeof url === 'string' ? new URL(url) : url
    let matches: Array<RoutePatternMatch<data>> = []
    for (let match of this.#trie.search(parsedUrl)) {
      matches.push(toMatch(match, parsedUrl))
    }
    return matches.sort(Specificity.descending)
  }
}

function toMatch<data>(result: Match<data>, url: URL): RoutePatternMatch<data> {
  return { ...result, url }
}
