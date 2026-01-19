/* eslint-disable jsdoc/require-param */
/* eslint-disable jsdoc/require-returns */
import { PartPattern } from '../part-pattern.ts'

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
 */
export function join(a: PartPattern, b: PartPattern): PartPattern {
  if (a.tokens.length === 0) return b
  if (b.tokens.length === 0) return a

  let tokens: Array<PartPattern.Token> = []

  // if `a` has a trailing separator (only optionals after it)
  // then omit the separator
  let aLastNonOptionalIndex = a.tokens.findLastIndex((token) => token.type !== '(' && token.type !== ')')
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
    if (token.type === ':' || token.type === '*') {
      tokens.push({ ...token, nameIndex: token.nameIndex + a.paramNames.length })
    } else {
      tokens.push(token)
    }
  })

  let paramNames = [...a.paramNames, ...b.paramNames]

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

  return new PartPattern({ tokens, paramNames, optionals }, { separator: '/' })
}