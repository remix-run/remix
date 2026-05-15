import type { RoutePattern, RoutePatternMatch } from './route-pattern.ts'
import { TrieMatcher } from './trie-matcher.ts'

/**
 * Successful pattern match paired with matcher-specific data.
 */
export type Match<source extends string = string, data = unknown> = RoutePatternMatch<source> & {
  data: data
}

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
  match(url: string | URL): Match<string, data> | null

  /**
   * Find all matches for a URL.
   *
   * @param url The URL to match
   * @returns All matches
   */
  matchAll(url: string | URL): Array<Match<string, data>>
}

/**
 * Create a new matcher.
 *
 * @param options Constructor options
 * @param options.ignoreCase When `true`, pathname matching is case-insensitive for all patterns. Defaults to `false`.
 * @returns A new matcher instance.
 */
export function createMatcher<data = unknown>(options?: { ignoreCase?: boolean }): Matcher<data> {
  return new TrieMatcher<data>(options)
}
