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
  for (let [name, requiredValues] of constraints) {
    let hasParam = params.has(name)
    let values = params.getAll(name)

    if (requiredValues.size === 0) {
      if (!hasParam) return false
      continue
    }

    for (let requiredValue of requiredValues) {
      if (!values.includes(requiredValue)) return false
    }
  }
  return true
}
