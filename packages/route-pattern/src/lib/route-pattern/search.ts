/**
 * - `null`: key must be present
 * - Empty `Set`: key must be present with a value
 * - Non-empty `Set`: key must be present with all these values
 *
 * ```ts
 * new Map([['q', null]])                // -> ?q, ?q=, ?q=1
 * new Map([['q', new Set()]])           // -> ?q=1
 * new Map([['q', new Set(['x', 'y'])]]) // -> ?q=x&q=y
 * ```
 */
export type Constraints = Map<string, Set<string> | null>

/**
 * Test if URL search params satisfy the given constraints.
 *
 * @param params the URL search params to test
 * @param constraints the search constraints to check against
 * @param ignoreCase whether to ignore case when matching param names and values
 * @returns true if the params satisfy all constraints
 */
export function test(
  params: URLSearchParams,
  constraints: Constraints,
  ignoreCase: boolean,
): boolean {
  for (let [name, constraint] of constraints) {
    // Check if param exists (case-aware)
    let hasParam: boolean
    let values: Array<string>

    if (ignoreCase) {
      let nameLower = name.toLowerCase()
      hasParam = false
      values = []
      for (let key of params.keys()) {
        if (key.toLowerCase() === nameLower) {
          hasParam = true
          values.push(...params.getAll(key))
        }
      }
    } else {
      hasParam = params.has(name)
      values = params.getAll(name)
    }

    if (constraint === null) {
      if (!hasParam) return false
      continue
    }

    if (constraint.size === 0) {
      if (values.every((value) => value === '')) return false
      continue
    }

    for (let value of constraint) {
      if (ignoreCase) {
        let valueLower = value.toLowerCase()
        if (!values.some((v) => v.toLowerCase() === valueLower)) return false
      } else {
        if (!values.includes(value)) return false
      }
    }
  }
  return true
}
