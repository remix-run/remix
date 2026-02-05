import type { RoutePattern } from '../route-pattern.ts'

/**
 * Test if URL search params satisfy the given constraints. Matching is case-sensitive.
 *
 * @param params The URL search params to test
 * @param constraints The search constraints to check against
 * @returns `true` if the params satisfy all constraints
 */
export function matchSearch(
  params: URLSearchParams,
  constraints: RoutePattern['ast']['search'],
): boolean {
  for (let [name, constraint] of constraints) {
    let hasParam = params.has(name)
    let values = params.getAll(name)

    if (constraint === null) {
      if (!hasParam) return false
      continue
    }

    if (constraint.size === 0) {
      if (values.every((value) => value === '')) return false
      continue
    }

    for (let value of constraint) {
      if (!values.includes(value)) return false
    }
  }
  return true
}
