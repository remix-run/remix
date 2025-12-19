import type { AST } from './ast.ts'
import type * as PartPattern from '../part-pattern/index.ts'
import * as Search from './search.ts'

export function join(a: AST, b: AST): AST {
  return {
    protocol: b.protocol ?? a.protocol,
    hostname: b.hostname ?? a.hostname,
    port: b.port ?? a.port,
    pathname: joinPathname(a.pathname, b.pathname),
    search: Search.join(a.search, b.search),
  }
}

function joinPathname(
  a: PartPattern.AST | undefined,
  b: PartPattern.AST | undefined,
): PartPattern.AST | undefined {
  if (a === undefined) return b
  if (b === undefined) return a

  let aLastIndex = a.tokens.findLastIndex((token) => token.type !== '(' && token.type !== ')')
  let aLast = aLastIndex === -1 ? undefined : a.tokens[aLastIndex]
  let aEndsWithSlash = aLast?.type === 'text' && aLast.text.at(-1) === '/'

  let bFirstIndex = b.tokens.findIndex((token) => token.type !== '(' && token.type !== ')')
  let bFirst = bFirstIndex === -1 ? undefined : b.tokens[bFirstIndex]
  let bBeginsWithSlash = bFirst?.type === 'text' && bFirst.text[0] === '/'

  let needsSlash = !aEndsWithSlash && !bBeginsWithSlash

  // tokens
  let tokens = a.tokens.slice()
  if (needsSlash) tokens.push({ type: 'text', text: '/' })
  b.tokens.forEach((token) => {
    if (token.type === ':') {
      tokens.push({
        ...token,
        nameIndex: token.nameIndex + a.paramNames.length,
      })
      return
    }
    if (token.type === '*') {
      tokens.push({
        ...token,
        nameIndex: token.nameIndex + a.paramNames.length,
      })
      return
    }
    tokens.push(token)
  })

  // paramNames
  let paramNames = a.paramNames.slice()
  b.paramNames.forEach((name) => paramNames.push(name))

  // optionals
  let tokenOffset = a.tokens.length + (needsSlash ? 1 : 0)
  let optionals = new Map(a.optionals)
  b.optionals.forEach((end, begin) => optionals.set(tokenOffset + begin, tokenOffset + end))

  return {
    tokens,
    paramNames,
    optionals,
  }
}
