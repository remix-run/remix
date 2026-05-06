import { RoutePattern, type Match, type Matcher } from '@remix-run/route-pattern'
import * as Specificity from '@remix-run/route-pattern/specificity'

/**
 * Matcher implementation that checks patterns in insertion order and sorts matches by specificity.
 *
 * Kept here in the bench project for benchmark comparison only; the published package now ships
 * a single trie-based matcher via `createMatcher`.
 */
export class ArrayMatcher<data> implements Matcher<data> {
  readonly ignoreCase: boolean
  #patterns: Array<{ pattern: RoutePattern; data: data }> = []

  constructor(options?: { ignoreCase?: boolean }) {
    this.ignoreCase = options?.ignoreCase ?? false
  }

  add(pattern: string | RoutePattern, data: data): void {
    pattern = typeof pattern === 'string' ? new RoutePattern(pattern) : pattern
    this.#patterns.push({ pattern, data })
  }

  match(url: string | URL): Match<string, data> | null {
    let bestMatch: Match<string, data> | null = null
    for (let entry of this.#patterns) {
      let match = entry.pattern.match(url, { ignoreCase: this.ignoreCase })
      if (match) {
        if (bestMatch === null || Specificity.greaterThan(match, bestMatch)) {
          bestMatch = { ...match, data: entry.data }
        }
      }
    }
    return bestMatch
  }

  matchAll(url: string | URL): Array<Match<string, data>> {
    let matches: Array<Match<string, data>> = []
    for (let entry of this.#patterns) {
      let match = entry.pattern.match(url, { ignoreCase: this.ignoreCase })
      if (match) {
        matches.push({ ...match, data: entry.data })
      }
    }
    return matches.sort(Specificity.descending)
  }
}
