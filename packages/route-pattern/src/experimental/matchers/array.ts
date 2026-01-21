import { RoutePattern } from "../route-pattern/index.ts"
import type { Matcher } from "./matcher.ts"
import * as Specificity from "../specificity.ts"

export class ArrayMatcher implements Matcher {
  #patterns: Array<RoutePattern> = []

  add(pattern: string | RoutePattern): void {
    pattern = typeof pattern === 'string' ? RoutePattern.parse(pattern) : pattern
    this.#patterns.push(pattern)
  }

  match(url: string | URL, compareFn = Specificity.descending): RoutePattern.Match | null {
    let bestMatch: RoutePattern.Match | null = null
    for (let pattern of this.#patterns) {
      let match = pattern.match(url)
      if (match) {
        if (bestMatch === null || compareFn(match, bestMatch) < 0) {
          bestMatch = match
        }
      }
    }
    return bestMatch
  }

  matchAll(url: string | URL, compareFn = Specificity.descending): Array<RoutePattern.Match> {
    let matches: Array<RoutePattern.Match> = []
    for (let pattern of this.#patterns) {
      let match = pattern.match(url)
      if (match) {
        matches.push(match)
      }
    }
    return matches.sort(compareFn)
  }
}