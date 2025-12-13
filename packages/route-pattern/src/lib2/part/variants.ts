import type { AST } from './ast'

export type Variant = {
  key: string
  paramNames: Array<string>
}

export function variants(ast: AST): Array<Variant> {
  let result: Array<Variant> = []

  let q: Array<{ index: number; variant: Variant }> = [
    { index: 0, variant: { key: '', paramNames: [] } },
  ]
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
        { index: ast.optionals.get(index)! + 1, variant: structuredClone(variant) }, // exclude optional
      )
      continue
    }
    if (token.type === ')') {
      q.push({ index: index + 1, variant })
      continue
    }

    if (token.type === ':') {
      variant.key += '{:}'
      variant.paramNames.push(ast.paramNames[token.nameIndex])
      q.push({ index: index + 1, variant })
      continue
    }

    if (token.type === '*') {
      variant.key += '{*}'
      if (token.nameIndex) {
        variant.paramNames.push(ast.paramNames[token.nameIndex])
      }
      q.push({ index: index + 1, variant })
      continue
    }

    if (token.type === 'text') {
      variant.key += token.text
      q.push({ index: index + 1, variant })
      continue
    }

    throw new Error(`internal: unrecognized token type '${token.type}'`)
  }

  return result
}
