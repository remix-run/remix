/* eslint-disable jsdoc/require-param */
/* eslint-disable jsdoc/require-returns */
import { PartPattern } from '../part-pattern.ts'

/**
 * Joins two pathnames, adding `/` at the join point unless already present.
 *
 * Conceptually:
 *
 * ```ts
 * pathname('a', 'b') -> 'a/b'
 * pathname('a/', 'b') -> 'a/b'
 * pathname('a', '/b') -> 'a/b'
 * pathname('a/', '/b') -> 'a/b'
 * pathname('(a/)', '(/b)') -> '(a/)/(/b)'
 * ```
 */
export function join(a: PartPattern, b: PartPattern): PartPattern {
  if (a.tokens.length === 0) return b
  if (b.tokens.length === 0) return a

  let aLast = a.tokens.at(-1)
  let bFirst = b.tokens[0]

  let tokens = a.tokens.slice(0, -1)
  let tokenOffset = tokens.length

  if (aLast?.type === 'text' && bFirst?.type === 'text') {
    // Note: leading `/` is ignored when parsing pathnames so `/b` is the same as `b`
    // so no need to explicitly dedup `/` for `.join('a/', '/b')` as its the same as `.join('a/', 'b')`
    let needsSlash = !aLast.text.endsWith('/') && !bFirst.text.startsWith('/')
    tokens.push({ type: 'text', text: aLast.text + (needsSlash ? '/' : '') + bFirst.text })
    tokenOffset += 1
  } else if (aLast?.type === 'text') {
    let needsSlash = !aLast.text.endsWith('/')
    tokens.push({ type: 'text', text: needsSlash ? aLast.text + '/' : aLast.text })
    tokenOffset += 1
    if (bFirst) {
      tokens.push(bFirst)
      tokenOffset += 1
    }
  } else if (bFirst?.type === 'text') {
    if (aLast) {
      tokens.push(aLast)
      tokenOffset += 1
    }
    let needsSlash = !bFirst.text.startsWith('/')
    tokens.push({ type: 'text', text: (needsSlash ? '/' : '') + bFirst.text })
    tokenOffset += 1
  } else {
    if (aLast) {
      tokens.push(aLast)
      tokenOffset += 1
    }
    tokens.push({ type: 'text', text: '/' })
    tokenOffset += 1
    if (bFirst) {
      tokens.push(bFirst)
      tokenOffset += 1
    }
  }

  for (let i = 1; i < b.tokens.length; i++) {
    let token = b.tokens[i]
    if (token.type === ':' || token.type === '*') {
      tokens.push({ ...token, nameIndex: token.nameIndex + a.paramNames.length })
    } else {
      tokens.push(token)
    }
  }

  let paramNames = [...a.paramNames, ...b.paramNames]

  let optionals = new Map(a.optionals)
  for (let [begin, end] of b.optionals) {
    optionals.set(tokenOffset + begin - 1, tokenOffset + end - 1)
  }

  return new PartPattern({ tokens, paramNames, optionals })
}
