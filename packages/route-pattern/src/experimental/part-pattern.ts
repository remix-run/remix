import { ParseError, unreachable } from './errors.ts'
import type { Span } from './span.ts'
import * as Variant from './variant.ts'

export type Token =
  | { type: 'text'; text: string }
  | { type: '(' | ')' }
  | { type: ':' | '*'; nameIndex: number }

type AST = {
  tokens: Array<Token>
  paramNames: Array<string>
  optionals: Map<number, number>
}

const IDENTIFIER_RE = /^[a-zA-Z_$][a-zA-Z_$0-9]*/

export class PartPattern {
  readonly tokens: AST['tokens']
  readonly paramNames: AST['paramNames']
  readonly optionals: AST['optionals']
  #variants: Array<Variant.Type> | undefined

  constructor(ast: AST) {
    this.tokens = ast.tokens
    this.paramNames = ast.paramNames
    this.optionals = ast.optionals
  }

  static parse(source: string, span?: Span): PartPattern {
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
          throw new ParseError('unmatched )', source, i)
        }
        ast.optionals.set(begin, ast.tokens.length)
        ast.tokens.push({ type: char })
        i += 1
        continue
      }

      // variable
      if (char === ':') {
        i += 1
        let name = IDENTIFIER_RE.exec(source.slice(i, span[1]))?.[0]
        if (!name) {
          throw new ParseError('missing variable name', source, i - 1)
        }
        ast.tokens.push({ type: ':', nameIndex: ast.paramNames.length })
        ast.paramNames.push(name)
        i += name.length
        continue
      }

      // wildcard
      if (char === '*') {
        i += 1
        let name = IDENTIFIER_RE.exec(source.slice(i, span[1]))?.[0]
        ast.tokens.push({ type: '*', nameIndex: ast.paramNames.length })
        ast.paramNames.push(name ?? '*')
        i += name?.length ?? 0
        continue
      }

      // escaped char
      if (char === '\\') {
        if (i + 1 === span[1]) {
          throw new ParseError('dangling escape', source, i)
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
      throw new ParseError('unmatched (', source, optionalStack.at(-1)!)
    }

    return new PartPattern(ast)
  }

  get variants(): Array<Variant.Type> {
    if (this.#variants === undefined) {
      this.#variants = Variant.generate(this)
    }

    return this.#variants
  }

  toString(): string {
    let result = ''

    for (let token of this.tokens) {
      if (token.type === '(' || token.type === ')') {
        result += token.type
        continue
      }

      if (token.type === 'text') {
        result += token.text
        continue
      }

      if (token.type === ':' || token.type === '*') {
        let name = this.paramNames[token.nameIndex]
        if (name === '*') name = ''
        result += `${token.type}${name}`
        continue
      }

      unreachable(token.type)
    }

    return result
  }

  /**
   * @param params The parameters to substitute into the pattern.
   * @returns The href (URL) for the given params, or null if no variant matches.
   */
  href(params: Record<string, string | number>): string | null {
    let best: Variant.Type | undefined
    for (let variant of this.variants) {
      let matches = variant.requiredParams.every((param) => params[param] !== undefined)
      if (!matches) continue

      if (best === undefined) {
        best = variant
        continue
      }

      if (variant.requiredParams.length > best.requiredParams.length) {
        best = variant
        continue
      }
      if (variant.requiredParams.length === best.requiredParams.length) {
        if (variant.tokens.length > best.tokens.length) {
          best = variant
          continue
        }
      }
    }

    // todo: I can't think of any case where there would end up being a tie
    // but the logic doesn't explicitly rule it out.
    // need to figure out if its possible and how to handle it.
    if (!best) return null

    let result = ''
    for (let token of best.tokens) {
      if (token.type === 'text') {
        result += token.text
        continue
      }

      if (token.type === ':' || token.type === '*') {
        let paramName = this.paramNames[token.nameIndex]
        result += String(params[paramName])
        continue
      }
    }
    return result
  }
}
