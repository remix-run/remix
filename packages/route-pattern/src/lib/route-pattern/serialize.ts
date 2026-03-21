import type { RoutePattern } from '../route-pattern.ts'

/**
 * Serialize search constraints to a query string.
 *
 * @param constraints the search constraints to convert
 * @returns the query string (without leading `?`), or undefined if empty
 */
export function serializeSearch(constraints: RoutePattern['ast']['search']): string | undefined {
  if (constraints.size === 0) return undefined

  let searchParams = new URLSearchParams()
  for (let [key, constraint] of constraints) {
    if (constraint.size === 0) {
      searchParams.append(key, '')
    } else {
      for (let value of constraint) {
        searchParams.append(key, value)
      }
    }
  }
  return searchParams.toString()
}
