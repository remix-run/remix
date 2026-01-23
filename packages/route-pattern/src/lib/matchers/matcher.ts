import type { RoutePattern } from '../route-pattern.ts'

export namespace Matcher {
  export type Match<source extends string = string, data = unknown> = RoutePattern.Match<source> & {
    data: data
  }
}

type CompareFn = (a: RoutePattern.Match, b: RoutePattern.Match) => number

/**
 * A type for matching URLs against patterns.
 */
export type Matcher<data = unknown> = {
  /**
   * Add a pattern to the matcher.
   *
   * @param pattern The pattern to add
   * @param data The data to associate with the pattern
   */
  add(pattern: string | RoutePattern, data: data): void

  /**
   * Find the best match for a URL.
   *
   * @param url The URL to match
   * @returns The match result, or `null` if no match was found
   */
  match(url: string | URL, compareFn?: CompareFn): Matcher.Match<string, data> | null
  /**
   * Find all matches for a URL.
   *
   * @param url The URL to match
   * @returns All matches
   */
  matchAll(url: string | URL, compareFn?: CompareFn): Array<Matcher.Match<string, data>>
}
