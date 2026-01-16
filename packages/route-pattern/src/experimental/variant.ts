import { unreachable } from './errors.ts'
import type { PartPattern } from './part-pattern.ts'

type Variant = {
  /** Params use `nameIndex` to reference params in the PartPattern's `paramNames` */
  tokens: Array<Extract<PartPattern.Token, { type: 'text' | ':' | '*' }>>

  /** Pre-computed subset of `paramNames` that are required for this variant */
  requiredParams: Array<string>
}

export type Type = Variant

export function generate(pattern: PartPattern): Array<Variant> {
  let result: Array<Variant> = []

  let stack: Array<{ index: number; tokens: Variant['tokens'] }> = [{ index: 0, tokens: [] }]

  while (stack.length > 0) {
    let { index, tokens } = stack.pop()!

    if (index === pattern.tokens.length) {
      let requiredParams: Array<string> = []
      for (let token of tokens) {
        if (token.type === ':' || token.type === '*') {
          requiredParams.push(pattern.paramNames[token.nameIndex])
        }
      }
      result.push({ tokens, requiredParams })
      continue
    }

    let token = pattern.tokens[index]

    if (token.type === '(') {
      stack.push(
        { index: index + 1, tokens },
        { index: pattern.optionals.get(index)! + 1, tokens: tokens.slice() },
      )
      continue
    }

    if (token.type === ')') {
      stack.push({ index: index + 1, tokens })
      continue
    }

    if (token.type === ':' || token.type === '*' || token.type === 'text') {
      tokens.push(token)
      stack.push({ index: index + 1, tokens })
      continue
    }
  }

  return result
}

export function toString(tokens: Variant['tokens'], paramNames: Array<string>): string {
  let result = ''

  for (let token of tokens) {
    if (token.type === 'text') {
      result += token.text
      continue
    }

    if (token.type === ':' || token.type === '*') {
      let name = paramNames[token.nameIndex]
      if (name === '*') name = ''
      result += `{${token.type}${name}}`
      continue
    }

    unreachable(token.type)
  }

  return result
}
