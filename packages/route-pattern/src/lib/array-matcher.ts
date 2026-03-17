import { RoutePattern } from './route-pattern.ts'
import type { Match, Matcher } from './matcher.ts'
import * as Specificity from './specificity.ts'

/**
 * Matcher implementation that checks patterns in insertion order and sorts matches by specificity.
 */
export class ArrayMatcher<data> implements Matcher<data> {
  /**
   * Whether pathname matching is case-insensitive.
   */
  readonly ignoreCase: boolean
  #patterns: Array<{ pattern: RoutePattern; data: data }> = []

  /**
   * @param options Constructor options
   * @param options.ignoreCase When `true`, pathname matching is case-insensitive for all patterns. Defaults to `false`.
   */
  constructor(options?: { ignoreCase?: boolean }) {
    this.ignoreCase = options?.ignoreCase ?? false
  }

  /**
   * Adds a pattern and associated data to the matcher.
   *
   * @param pattern Pattern to register.
   * @param data Data returned when the pattern matches.
   */
  add(pattern: string | RoutePattern, data: data): void {
    pattern = typeof pattern === 'string' ? new RoutePattern(pattern) : pattern
    this.#patterns.push({ pattern, data })
  }

  /**
   * Returns the best matching pattern for a URL.
   *
   * @param url URL to match.
   * @param compareFn Specificity comparer used to rank matches.
   * @returns The best match, or `null` when nothing matches.
   */
  match(url: string | URL, compareFn = Specificity.descending): Match<string, data> | null {
    let bestMatch: Match<string, data> | null = null
    for (let entry of this.#patterns) {
      let match = entry.pattern.match(url, { ignoreCase: this.ignoreCase })
      if (match) {
        if (bestMatch === null || compareFn(match, bestMatch) < 0) {
          bestMatch = { ...match, data: entry.data }
        }
      }
    }
    return bestMatch
  }

  /**
   * Returns every pattern that matches a URL.
   *
   * @param url URL to match.
   * @param compareFn Specificity comparer used to sort matches.
   * @returns All matching routes sorted by specificity.
   */
  matchAll(url: string | URL, compareFn = Specificity.descending): Array<Match<string, data>> {
    let matches: Array<Match<string, data>> = []
    for (let entry of this.#patterns) {
      let match = entry.pattern.match(url, { ignoreCase: this.ignoreCase })
      if (match) {
        matches.push({ ...match, data: entry.data })
      }
    }
    return matches.sort(compareFn)
  }
}
