import type { Span } from '../span'
import type { AST } from './ast'

const identifierRE = /^[a-zA-Z_$][a-zA-Z_$0-9]*/

export function parse(source: string, span?: Span): AST {
  span ??= [0, source.length]

  let ast: AST = {
    tokens: [],
    paramNames: [],
    optionals: new Map(),
  }

  let appendText = (text: string) => {
    let currentToken = ast.tokens.at(-1)
    if (currentToken?.type === 'text') {
      currentToken.text += text
    } else {
      ast.tokens.push({ type: 'text', text })
    }
  }

  let i = span[0]
  let optionalStack: Array<number> = []
  while (i < span[1]) {
    let char = source[i]

    // optional begin
    if (char === '(') {
      optionalStack.push(ast.tokens.length)
      ast.tokens.push({ type: char })
      i += 1
      continue
    }

    // optional end
    if (char === ')') {
      let begin = optionalStack.pop()
      if (begin === undefined) {
        throw new Error(`unmatched ) at ${i}`)
      }
      ast.optionals.set(begin, ast.tokens.length)
      ast.tokens.push({ type: char })
      i += 1
      continue
    }

    // variable
    if (char === ':') {
      i += 1
      let name = identifierRE.exec(source.slice(i, span[1]))?.[0]
      if (!name) {
        throw new Error(`missing variable name at ${i}`)
      }
      ast.tokens.push({ type: ':', nameIndex: ast.paramNames.length })
      ast.paramNames.push(name)
      i += name.length
      continue
    }

    // wildcard
    if (char === '*') {
      i += 1
      let name = identifierRE.exec(source.slice(i, span[1]))?.[0]
      if (name) {
        ast.tokens.push({ type: '*', nameIndex: ast.paramNames.length })
        ast.paramNames.push(name)
        i += name.length
      } else {
        ast.tokens.push({ type: '*' })
      }
      continue
    }

    // escaped char
    if (char === '\\') {
      if (i + 1 === span[1]) {
        throw new Error(`dangling escape at ${i}`)
      }
      let text = source.slice(i, i + 2)
      appendText(text)
      i += text.length
      continue
    }

    // text
    appendText(char)
    i += 1
  }
  if (optionalStack.length > 0) {
    throw new Error(`unmatched ( at ${optionalStack.at(-1)!}`)
  }

  return ast
}
