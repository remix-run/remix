import type { RoutePatternAST } from './ast.ts'
import { parsePattern } from './parse.ts'

import { Trie } from './matcher/trie.ts'
import type { Match } from './matcher/types.ts'

export type RoutePatternMatcher<data = unknown> = {
  readonly ignoreCase: boolean
  add(pattern: string | RoutePatternAST, data: data): void
  matchAll(url: string | URL): Array<RoutePatternMatch<data>>
}

export type RoutePatternMatch<data> = Match<data> & { url: URL }

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

  matchAll(url: string | URL): Array<RoutePatternMatch<data>> {
    let parsedUrl = typeof url === 'string' ? new URL(url) : url
    let results = this.#trie.search(parsedUrl)
    let matches: Array<RoutePatternMatch<data>> = []
    for (let r of results) {
      matches.push({
        ast: r.ast,
        url: parsedUrl,
        data: r.data,
        params: r.params,
        paramsMeta: r.paramsMeta,
      })
    }
    return matches
  }
}
