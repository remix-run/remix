import type { AST } from './ast.ts'
import type * as Part from './part/index.ts'

export function join(a: AST, b: AST): AST {
  return {
    protocol: b.protocol ?? a.protocol,
    hostname: b.hostname ?? a.hostname,
    port: b.port ?? a.port,
    pathname: joinPathname(a.pathname, b.pathname),
    search: b.search, // todo
  }
}

function joinPathname(a: Part.AST | undefined, b: Part.AST | undefined): Part.AST | undefined {
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
      token = structuredClone(token)
      token.nameIndex += a.paramNames.length
      tokens.push(token)
      return
    }
    if (token.type === '*') {
      token = structuredClone(token)
      if (token.nameIndex) token.nameIndex += a.paramNames.length
      tokens.push(token)
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
