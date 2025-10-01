import type { Matcher, MatchResult } from './matcher.ts'
import { RoutePattern } from './route-pattern.ts'

/**
 * A simple array-based matcher that compiles route patterns to regular expressions.
 *
 * **Use RegExpMatcher when:**
 * - You have a single or handful of patterns
 * - Build time is critical (cold boot scenarios)
 * - Pattern set changes frequently (cheap to rebuild)
 * - Memory footprint needs to be minimal
 */
export class RegExpMatcher<T = any> implements Matcher<T> {
  #pairs: { pattern: RoutePattern; data: T }[] = []
  #count = 0

  add<P extends string>(pattern: P | RoutePattern<P>, data: T): void {
    let routePattern = typeof pattern === 'string' ? new RoutePattern(pattern) : pattern
    this.#pairs.push({ pattern: routePattern, data })
    this.#count++
  }

  match(url: string | URL): MatchResult<T> | null {
    if (typeof url === 'string') url = new URL(url)

    for (let { pattern, data } of this.#pairs) {
      let match = pattern.match(url)
      if (match) {
        return { data, params: match.params, url: match.url }
      }
    }

    return null
  }

  *matchAll(url: string | URL): Generator<MatchResult<T>> {
    if (typeof url === 'string') url = new URL(url)

    for (let { pattern, data } of this.#pairs) {
      let match = pattern.match(url)
      if (match) {
        yield { data, params: match.params, url: match.url }
      }
    }
  }

  get size(): number {
    return this.#count
  }
}
