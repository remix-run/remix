import type { RoutePattern } from '../route-pattern.ts'

/**
 * Serialize search constraints to a query string.
 *
 * @param constraints the search constraints to convert
 * @returns the query string (without leading `?`), or undefined if empty
 */
export function serializeSearch(constraints: RoutePattern['ast']['search']): string | undefined {
  if (constraints.size === 0) {
    return undefined
  }

  let parts: Array<string> = []

  for (let [key, constraint] of constraints) {
    if (constraint === null) {
      parts.push(encodeURIComponent(key))
    } else if (constraint.size === 0) {
      parts.push(`${encodeURIComponent(key)}=`)
    } else {
      for (let value of constraint) {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      }
    }
  }

  let result = parts.join('&')
  return result || undefined
}
