import type { RoutePattern, RoutePatternMatch } from './route-pattern.ts'

export type Match<source extends string = string, data = unknown> = RoutePatternMatch<source> & {
  data: data
}

type CompareFn = (a: RoutePatternMatch, b: RoutePatternMatch) => number

/**
 * A type for matching URLs against patterns.
 */
export type Matcher<data = unknown> = {
  /**
   * When `true`, pathname matching is case-insensitive for all patterns in this matcher. Hostname is always case-insensitive; search remains case-sensitive.
   */
  readonly ignoreCase: boolean

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
  match(url: string | URL, compareFn?: CompareFn): Match<string, data> | null

  /**
   * Find all matches for a URL.
   *
   * @param url The URL to match
   * @returns All matches
   */
  matchAll(url: string | URL, compareFn?: CompareFn): Array<Match<string, data>>
}
