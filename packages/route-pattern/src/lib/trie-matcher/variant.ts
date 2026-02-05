import { unreachable } from '../unreachable.ts'
import type { PartPattern, PartPatternToken } from '../route-pattern/part-pattern.ts'
import type { RoutePattern } from '../route-pattern.ts'
import * as RE from '../regexp.ts'

type Variant = {
  protocol: 'http' | 'https'
  hostname:
    | { type: 'static'; value: string }
    | { type: 'dynamic'; value: PartPattern }
    | { type: 'any' }
  port: string
  pathname: PartPatternVariant
}

type Segment =
  | { type: 'static'; key: string }
  | { type: 'variable'; key: string; regexp: RegExp }
  | { type: 'wildcard'; key: string; regexp: RegExp }

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
      PartPatternVariant.generate(pattern.ast.hostname).map((variant) => ({ type: 'static' as const, value: variant.toString('.') })) :
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

  constructor(tokens: Array<Token>) {
    this.tokens = tokens
  }

  static generate(pattern: PartPattern): Array<PartPatternVariant> {
    let result: Array<PartPatternVariant> = []

    let stack: Array<{ index: number; tokens: Array<Token> }> = [{ index: 0, tokens: [] }]

    while (stack.length > 0) {
      let { index, tokens } = stack.pop()!

      if (index === pattern.tokens.length) {
        result.push(new PartPatternVariant(tokens))
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

  params(): Array<Param> {
    let result = []
    for (let token of this.tokens) {
      if (token.type === ':' || token.type === '*') {
        result.push(token)
      }
    }
    return result
  }

  toString(separator: string): string {
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
        result += separator
        continue
      }

      unreachable(token.type)
    }

    return result
  }

  segments(options?: { ignoreCase?: boolean }): Array<Segment> {
    let ignoreCase = options?.ignoreCase ?? false
    let result: Array<Segment> = []

    let key = ''
    let reSource = ''
    let reFlags = ignoreCase ? 'di' : 'd'
    let type: 'static' | 'variable' | 'wildcard' = 'static'

    for (let token of this.tokens) {
      if (token.type === 'separator') {
        if (type === 'static') {
          result.push({ type: 'static', key: ignoreCase ? key.toLowerCase() : key })
          key = ''
          reSource = ''
          continue
        }
        if (type === 'variable') {
          result.push({ type: 'variable', key, regexp: new RegExp(reSource, reFlags) })
          key = ''
          reSource = ''
          type = 'static'
          continue
        }
        if (type === 'wildcard') {
          key += '/'
          reSource += RE.escape('/')
          continue
        }
        unreachable(type)
      }

      if (token.type === 'text') {
        key += token.text
        reSource += RE.escape(token.text)
        continue
      }

      if (token.type === ':') {
        key += '{:}'
        reSource += `([^/]+)`
        if (type === 'static') type = 'variable'
        continue
      }

      if (token.type === '*') {
        key += '{*}'
        reSource += `(.*)`
        type = 'wildcard'
        continue
      }

      unreachable(token.type)
    }

    if (type === 'static') {
      result.push({ type: 'static', key: ignoreCase ? key.toLowerCase() : key })
    }
    if (type === 'variable' || type === 'wildcard') {
      result.push({ type, key, regexp: new RegExp(reSource, reFlags) })
    }
    return result
  }
}
