import type { RoutePattern } from './route-pattern.ts'

/**
 * An interface for matching URLs against patterns.
 */
export interface Matcher<T = any> {
  /**
   * Add a pattern to the matcher.
   *
   * @param pattern The pattern to add
   * @param data The data to associate with the pattern
   */
  add<P extends string>(pattern: P | RoutePattern<P>, data: T): void
  /**
   * Find the best match for a URL.
   *
   * @param url The URL to match
   * @return The match result, or `null` if no match was found
   */
  match(url: string | URL): MatchResult<T> | null
  /**
   * Find all matches for a URL.
   *
   * @param url The URL to match
   * @return A generator that yields all matches
   */
  matchAll(url: string | URL): Generator<MatchResult<T>>
  /**
   * The number of patterns in the matcher.
   */
  size: number
}

/**
 * The result of matching a URL against a pattern.
 */
export interface MatchResult<T = any> {
  /**
   * The data associated with the matched pattern.
   */
  data: T
  /**
   * The parameters extracted from the URL.
   */
  params: Record<string, string>
  /**
   * The matched URL.
   */
  url: URL
}
