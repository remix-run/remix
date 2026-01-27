import { RoutePattern } from './route-pattern.ts'
import type { Matcher } from './matcher.ts'
import * as Specificity from './specificity.ts'

export class ArrayMatcher<data> implements Matcher<data> {
  #patterns: Array<{ pattern: RoutePattern; data: data }> = []

  add(pattern: string | RoutePattern, data: data): void {
    pattern = typeof pattern === 'string' ? new RoutePattern(pattern) : pattern
    this.#patterns.push({ pattern, data })
  }

  match(url: string | URL, compareFn = Specificity.descending): Matcher.Match<string, data> | null {
    let bestMatch: Matcher.Match<string, data> | null = null
    for (let entry of this.#patterns) {
      let match = entry.pattern.match(url)
      if (match) {
        if (bestMatch === null || compareFn(match, bestMatch) < 0) {
          bestMatch = { ...match, data: entry.data }
        }
      }
    }
    return bestMatch
  }

  matchAll(
    url: string | URL,
    compareFn = Specificity.descending,
  ): Array<Matcher.Match<string, data>> {
    let matches: Array<Matcher.Match<string, data>> = []
    for (let entry of this.#patterns) {
      let match = entry.pattern.match(url)
      if (match) {
        matches.push({ ...match, data: entry.data })
      }
    }
    return matches.sort(compareFn)
  }
}
