import type { AST } from './ast'

export function toRegExp(ast: AST, paramValueRE: RegExp): RegExp {
  let source = toRegExpSource(ast, paramValueRE)
  return new RegExp('^' + source + '$')
}

export function toRegExpSource(ast: AST, paramValueRE: RegExp): string {
  let source = ''

  for (let token of ast.tokens) {
    if (token.type === '(') {
      source += `(?:`
      continue
    }

    if (token.type === ')') {
      source += ')?'
      continue
    }

    if (token.type === ':') {
      source += `(${paramValueRE.source})`
      continue
    }

    if (token.type === '*') {
      source += token.nameIndex === undefined ? '(?:.*)' : '(.*)'
      continue
    }

    if (token.type === 'text') {
      source += escape(token.text)
      continue
    }

    // todo: make this a type error if `token.type` is not `never` using a custom error
    throw new Error(`internal: unrecognized token type '${token.type}'`)
  }
  return source
}

/** Polyfill for `RegExp.escape` */
const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
