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
 * Parse a search string into search constraints.
 *
 * Search constraints define what query params must be present:
 * - `null`: param must be present (e.g., `?q`, `?q=`, `?q=1`)
 * - Empty `Set`: param must be present with a value (e.g., `?q=1`)
 * - Non-empty `Set`: param must be present with all these values (e.g., `?q=x&q=y`)
 *
 * Examples:
 * ```ts
 * parse('q')       // -> Map([['q', null]])
 * parse('q=')      // -> Map([['q', new Set()]])
 * parse('q=x&q=y') // -> Map([['q', new Set(['x', 'y'])]])
 * ```
 *
 * @param source the search string to parse (without leading `?`)
 * @returns the parsed search constraints
 */
export function parse(source: string): Constraints {
  let constraints: Constraints = new Map()

  for (let param of source.split('&')) {
    if (param === '') continue
    let equalIndex = param.indexOf('=')

    // `?q`
    if (equalIndex === -1) {
      let name = decodeURIComponent(param)
      if (!constraints.get(name)) {
        constraints.set(name, null)
      }
      continue
    }

    let name = decodeURIComponent(param.slice(0, equalIndex))
    let value = decodeURIComponent(param.slice(equalIndex + 1))

    // `?q=`
    if (value.length === 0) {
      if (!constraints.get(name)) {
        constraints.set(name, new Set())
      }
      continue
    }

    // `?q=1`
    let constraint = constraints.get(name)
    constraints.set(name, constraint ? constraint.add(value) : new Set([value]))
  }

  return constraints
}

/**
 * Joins two search patterns, merging params and their constraints.
 *
 * Conceptually:
 *
 * ```ts
 * search('?a', '?b') -> '?a&b'
 * search('?a=1', '?a=2') -> '?a=1&a=2'
 * search('?a=1', '?b=2') -> '?a=1&b=2'
 * search('', '?a') -> '?a'
 * ```
 *
 * @param a the first search constraints
 * @param b the second search constraints
 * @returns the merged search constraints
 */
export function join(a: Constraints, b: Constraints): Constraints {
  let result: Constraints = new Map()

  for (let [name, constraint] of a) {
    result.set(name, constraint === null ? null : new Set(constraint))
  }

  for (let [name, constraint] of b) {
    let current = result.get(name)

    if (current === null || current === undefined) {
      result.set(name, constraint === null ? null : new Set(constraint))
      continue
    }

    if (constraint !== null) {
      for (let value of constraint) {
        current.add(value)
      }
    }
  }

  return result
}

export type HrefParams = Record<
  string,
  string | number | null | undefined | Array<string | number | null | undefined>
>

/**
 * Convert search constraints to a query string.
 *
 * @param constraints the search constraints to convert
 * @returns the query string (without leading `?`), or undefined if empty
 */
export function toString(constraints: Constraints): string | undefined {
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
