/* eslint-disable jsdoc/require-param */
/* eslint-disable jsdoc/require-returns */

import type { RoutePattern } from './route-pattern.ts'
import { HrefError } from '../errors.ts'

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

export type HrefParams = Record<string, string | number | Array<string | number>>

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

export function href(pattern: RoutePattern, params: HrefParams): string | undefined {
  let constraints = pattern.ast.search
  if (constraints.size === 0 && Object.keys(params).length === 0) {
    return undefined
  }

  let urlSearchParams = new URLSearchParams()

  for (let [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (let v of value) {
        urlSearchParams.append(key, String(v))
      }
    } else {
      urlSearchParams.append(key, String(value))
    }
  }

  let missingParams: Array<string> = []
  for (let [key, constraint] of constraints) {
    if (constraint === null) {
      if (key in params) continue
      urlSearchParams.append(key, '')
    } else if (constraint.size === 0) {
      if (key in params) continue
      missingParams.push(key)
    } else {
      for (let value of constraint) {
        if (urlSearchParams.getAll(key).includes(value)) continue
        urlSearchParams.append(key, value)
      }
    }
  }

  if (missingParams.length > 0) {
    throw new HrefError({
      type: 'missing-search-params',
      pattern,
      missingParams,
      searchParams: params,
    })
  }

  let result = urlSearchParams.toString()
  return result || undefined
}
