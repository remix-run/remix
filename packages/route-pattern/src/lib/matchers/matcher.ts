import type { RoutePattern } from '../route-pattern.ts'

type CompareFn = (a: RoutePattern.Match, b: RoutePattern.Match) => number

/**
 * A type for matching URLs against patterns.
 */
export type Matcher = {
  /**
   * Add a pattern to the matcher.
   *
   * @param pattern The pattern to add
   */
  add(pattern: string | RoutePattern): void

  /**
   * Find the best match for a URL.
   *
   * @param url The URL to match
   * @returns The match result, or `null` if no match was found
   */
  match(url: string | URL, compareFn?: CompareFn): RoutePattern.Match | null
  /**
   * Find all matches for a URL.
   *
   * @param url The URL to match
   * @returns All matches
   */
  matchAll(url: string | URL, compareFn?: CompareFn): Array<RoutePattern.Match>
}