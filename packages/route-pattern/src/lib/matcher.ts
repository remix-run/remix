import type { RoutePattern } from './route-pattern.ts'

/**
 * An interface for matching URLs against patterns.
 */
export interface Matcher<data = unknown> {
  /**
   * Add a pattern to the matcher.
   *
   * @param pattern The pattern to add
   * @param data The data to associate with the pattern
   */
  add<source extends string>(pattern: source | RoutePattern<source>, data: data): void
  /**
   * Find the best match for a URL.
   *
   * @param url The URL to match
   * @returns The match result, or `null` if no match was found
   */
  match(url: string | URL): MatchResult<data> | null
  /**
   * Find all matches for a URL.
   *
   * @param url The URL to match
   * @returns A generator that yields all matches
   */
  matchAll(url: string | URL): Generator<MatchResult<data>>
  /**
   * The number of patterns in the matcher.
   */
  size: number
}

/**
 * The result of matching a URL against a pattern.
 */
export interface MatchResult<data = unknown> {
  /**
   * The data associated with the matched pattern.
   */
  data: data
  /**
   * The parameters extracted from the URL.
   */
  params: Record<string, string>
  /**
   * The matched URL.
   */
  url: URL
}
