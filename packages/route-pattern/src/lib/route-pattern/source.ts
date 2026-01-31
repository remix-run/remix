import type { RoutePattern } from '../route-pattern.ts'
import { unreachable } from '../unreachable.ts'
import type { PartPattern } from './part-pattern.ts'

export function part(partPattern: PartPattern): string {
  let result = ''

  for (let token of partPattern.tokens) {
    if (token.type === '(' || token.type === ')') {
      result += token.type
      continue
    }

    if (token.type === 'text') {
      result += token.text
      continue
    }

    if (token.type === ':' || token.type === '*') {
      let name = token.name === '*' ? '' : token.name
      result += `${token.type}${name}`
      continue
    }

    if (token.type === 'separator') {
      result += partPattern.separator
      continue
    }

    unreachable(token.type)
  }

  return result
}

/**
 * Convert search constraints to a query string.
 *
 * @param constraints the search constraints to convert
 * @returns the query string (without leading `?`), or undefined if empty
 */
export function search(constraints: RoutePattern['ast']['search']): string | undefined {
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
