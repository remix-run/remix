import type { RoutePattern } from '../route-pattern.ts'
import { PartPattern, type PartPatternToken } from './part-pattern.ts'

type Pathname = RoutePattern['ast']['pathname']

/**
 * Joins two pathnames, adding slash between them if needed.
 *
 * Trailing slash is omitted from `a`.
 * A slash is added between `a` and `b` if `b` does not have a leading slash.
 *
 * Definitions:
 * - A leading slash can only have parens `(` `)` before it.
 * - A trailing slash can only have parens `(` `)` after it.
 *
 * Conceptually:
 *
 * ```ts
 * join('a', 'b') -> 'a/b'
 * join('a/', 'b') -> 'a/b'
 * join('a', '/b') -> 'a/b'
 * join('a/', '/b') -> 'a/b'
 * join('(a)', '(b)') -> '(a)/(b)'
 * join('(a/)', '(b)') -> '(a)/(b)'
 * join('(a)', '(/b)') -> '(a)(/b)'
 * join('(a/)', '(/b)') -> '(a)(/b)'
 * ```
 *
 * @param a the first pathname pattern
 * @param b the second pathname pattern
 * @returns the joined pathname pattern
 */
export function joinPathname(a: Pathname, b: Pathname): Pathname {
  if (a.tokens.length === 0) return b
  if (b.tokens.length === 0) return a

  let tokens: Array<PartPatternToken> = []

  // if `a` has a trailing separator (only optionals after it)
  // then omit the separator
  let aLastNonOptionalIndex = a.tokens.findLastIndex(
    (token) => token.type !== '(' && token.type !== ')',
  )
  let aLastNonOptional = a.tokens[aLastNonOptionalIndex]
  let aHasTrailingSeparator = aLastNonOptional?.type === 'separator'

  a.tokens.forEach((token, index) => {
    if (index === aLastNonOptionalIndex && token.type === 'separator') {
      return
    }
    tokens.push(token)
  })

  // if `b` does not have a leading separator (only optionals before it)
  // then add a separator
  let bFirstNonOptional = b.tokens.find((token) => token.type !== '(' && token.type !== ')')
  let needsSeparator = bFirstNonOptional === undefined || bFirstNonOptional.type !== 'separator'
  if (needsSeparator) {
    tokens.push({ type: 'separator' })
  }

  let tokenOffset = tokens.length

  b.tokens.forEach((token) => {
    tokens.push(token)
  })

  let optionals = new Map()
  for (let [begin, end] of a.optionals) {
    if (aHasTrailingSeparator) {
      // one less token before this optional since trailing slash token was omitted
      if (begin > aLastNonOptionalIndex) begin -= 1
      if (end > aLastNonOptionalIndex) end -= 1
    }
    optionals.set(begin, end)
  }
  for (let [begin, end] of b.optionals) {
    optionals.set(tokenOffset + begin, tokenOffset + end)
  }

  return new PartPattern({ tokens, optionals }, { type: 'pathname' })
}

type Search = RoutePattern['ast']['search']

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
export function joinSearch(a: Search, b: Search): Search {
  let result: Search = new Map()

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
