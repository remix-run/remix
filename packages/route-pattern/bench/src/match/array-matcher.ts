import { createMatcher } from '@remix-run/route-pattern/match'
import type { Match, Matcher, MultiMatcher } from '@remix-run/route-pattern/match'
import * as Specificity from '@remix-run/route-pattern/specificity'
import type { RoutePattern } from '@remix-run/route-pattern'

/**
 * Matcher implementation that checks patterns in insertion order and sorts matches by specificity.
 *
 * Kept here in the bench project for benchmark comparison only.
 */
export class ArrayMatcher implements MultiMatcher<unknown> {
  readonly ignoreCase: boolean
  #patterns: Array<Matcher> = []

  constructor(options?: { ignoreCase?: boolean }) {
    this.ignoreCase = options?.ignoreCase ?? false
  }

  add(pattern: string | RoutePattern): void {
    this.#patterns.push(createMatcher(pattern, { ignoreCase: this.ignoreCase }))
  }

  match(url: string | URL): Match<string> | null {
    let bestMatch: Match<string> | null = null
    for (let pattern of this.#patterns) {
      let match = pattern.match(url)
      if (match && (bestMatch === null || Specificity.descending(match, bestMatch) < 0)) {
        bestMatch = match
      }
    }
    return bestMatch
  }

  matchAll(url: string | URL): Array<Match<string>> {
    let matches: Array<Match<string>> = []
    for (let pattern of this.#patterns) {
      let match = pattern.match(url)
      if (match) {
        matches.push(match)
      }
    }
    return matches.sort(Specificity.descending)
  }
}
