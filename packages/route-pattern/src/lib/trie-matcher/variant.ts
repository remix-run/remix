import { unreachable } from '../errors.ts'
import type { PartPattern, PartPatternToken } from '../route-pattern/part-pattern.ts'
import type { RoutePattern } from '../route-pattern.ts'

type Variant = {
  protocol: 'http' | 'https'
  hostname:
    | { type: 'static'; value: string }
    | { type: 'dynamic'; value: PartPattern }
    | { type: 'any' }
  port: string
  pathname: PartPatternVariant
}

export function generate(pattern: RoutePattern): Array<Variant> {
  // prettier-ignore
  let protocols =
    pattern.ast.protocol === null ? ['http', 'https'] as const :
    pattern.ast.protocol === 'http(s)' ? ['http', 'https'] as const :
    [pattern.ast.protocol]

  // prettier-ignore
  let hostnames =
    pattern.ast.hostname === null ? [{ type: 'any' as const }] :
    pattern.ast.hostname.params.length === 0 ?
      PartPatternVariant.generate(pattern.ast.hostname).map((variant) => ({ type: 'static' as const, value: variant.toString() })) :
      [{ type: 'dynamic' as const, value: pattern.ast.hostname }]

  let pathnames = PartPatternVariant.generate(pattern.ast.pathname)

  let result: Array<Variant> = []
  for (let protocol of protocols) {
    for (let hostname of hostnames) {
      for (let pathname of pathnames) {
        result.push({ protocol, hostname, port: pattern.ast.port ?? '', pathname })
      }
    }
  }

  return result
}

type Token = Extract<PartPatternToken, { type: 'text' | ':' | '*' | 'separator' }>
type Param = Extract<PartPatternToken, { type: ':' | '*' }>

export class PartPatternVariant {
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

  static generate(pattern: PartPattern): Array<PartPatternVariant> {
    let result: Array<PartPatternVariant> = []

    let stack: Array<{ index: number; tokens: Array<Token> }> = [{ index: 0, tokens: [] }]

    while (stack.length > 0) {
      let { index, tokens } = stack.pop()!

      if (index === pattern.tokens.length) {
        result.push(new PartPatternVariant(pattern, tokens))
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
