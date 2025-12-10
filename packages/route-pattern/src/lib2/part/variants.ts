import type { AST } from './ast'

export function variants(ast: AST): Array<string> {
  let result: Array<string> = []

  let q: Array<{ index: number; variant: string }> = [{ index: 0, variant: '' }]
  while (q.length > 0) {
    let { index, variant } = q.pop()!

    if (index === ast.tokens.length) {
      result.push(variant)
      continue
    }

    let token = ast.tokens[index]
    if (token.type === '(') {
      q.push(
        { index: index + 1, variant }, // include optional
        { index: ast.optionals.get(index)! + 1, variant }, // exclude optional
      )
      continue
    }
    if (token.type === ')') {
      q.push({ index: index + 1, variant })
      continue
    }

    if (token.type === ':') {
      q.push({ index: index + 1, variant: variant + `{:${token.nameIndex}}` })
      continue
    }

    if (token.type === '*') {
      q.push({ index: index + 1, variant: variant + `{*${token.nameIndex ?? ''}}` })
      continue
    }

    if (token.type === 'text') {
      q.push({ index: index + 1, variant: variant + token.text })
      continue
    }

    throw new Error(`internal: unrecognized token type '${token.type}'`)
  }

  return result
}
