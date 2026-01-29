import { unreachable } from './errors.ts'
import type { PartPattern, PartPatternToken } from './route-pattern/part-pattern.ts'

type Token = Extract<PartPatternToken, { type: 'text' | ':' | '*' | 'separator' }>

type Param = Extract<PartPatternToken, { type: ':' | '*' }>

export class Variant {
  tokens: Array<Token>

  #partPattern: PartPattern
  #params: Array<Param> | undefined

  constructor(partPattern: PartPattern, tokens: Array<Token>) {
    this.#partPattern = partPattern
    this.tokens = tokens
  }

  get params(): Array<Param> {
    if (this.#params === undefined) {
      this.#params = []
      for (let token of this.tokens) {
        if (token.type === ':' || token.type === '*') {
          this.#params.push(token)
        }
      }
    }
    return this.#params
  }

  static generate(pattern: PartPattern): Array<Variant> {
    let result: Array<Variant> = []

    let stack: Array<{ index: number; tokens: Array<Token> }> = [{ index: 0, tokens: [] }]

    while (stack.length > 0) {
      let { index, tokens } = stack.pop()!

      if (index === pattern.tokens.length) {
        result.push(new Variant(pattern, tokens))
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

      if (
        token.type === ':' ||
        token.type === '*' ||
        token.type === 'text' ||
        token.type === 'separator'
      ) {
        tokens.push(token)
        stack.push({ index: index + 1, tokens })
        continue
      }
      unreachable(token.type)
    }

    return result
  }

  toString(): string {
    let result = ''

    for (let token of this.tokens) {
      if (token.type === 'text') {
        result += token.text
        continue
      }

      if (token.type === ':' || token.type === '*') {
        let name = token.name === '*' ? '' : token.name
        result += `{${token.type}${name}}`
        continue
      }

      if (token.type === 'separator') {
        result += this.#partPattern.separator
        continue
      }

      unreachable(token.type)
    }

    return result
  }
}
