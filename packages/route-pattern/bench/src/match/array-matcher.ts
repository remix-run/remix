import { createMatcher } from '@remix-run/route-pattern/match'
import type { Match, Matcher, MultiMatcher } from '@remix-run/route-pattern/match'
import * as Specificity from '@remix-run/route-pattern/specificity'
import type { RoutePattern } from '@remix-run/route-pattern'

/**
 * Matcher implementation that checks patterns in insertion order and sorts matches by specificity.
 *
 * Kept here in the bench project for benchmark comparison only.
 */
export class ArrayMatcher<data = unknown> implements MultiMatcher<data> {
  readonly ignoreCase: boolean
  #patterns: Array<{ matcher: Matcher; data: data }> = []

  constructor(options?: { ignoreCase?: boolean }) {
    this.ignoreCase = options?.ignoreCase ?? false
  }

  add(pattern: string | RoutePattern, data: data): void {
    this.#patterns.push({ matcher: createMatcher(pattern, { ignoreCase: this.ignoreCase }), data })
  }

  match(url: string | URL): Match<string, data> | null {
    let bestMatch: Match<string, data> | null = null
    for (let pattern of this.#patterns) {
      let match = pattern.matcher.match(url)
      if (match && (bestMatch === null || Specificity.descending(match, bestMatch) < 0)) {
        bestMatch = { ...match, data: pattern.data }
      }
    }
    return bestMatch
  }

  matchAll(url: string | URL): Array<Match<string, data>> {
    let matches: Array<Match<string, data>> = []
    for (let pattern of this.#patterns) {
      let match = pattern.matcher.match(url)
      if (match) {
        matches.push({ ...match, data: pattern.data })
      }
    }
    return matches.sort(Specificity.descending)
  }
}
