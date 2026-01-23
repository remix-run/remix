import { ParseError, unreachable } from './errors.ts'
import type { Span } from './span.ts'
import { Variant } from './variant.ts'

type MatchParam = {
  type: ':' | '*'
  name: string
  value: string
  begin: number
  end: number
}

export namespace PartPattern {
  export type Match = Array<MatchParam>
  export type Token =
    | { type: 'text'; text: string }
    | { type: 'separator' }
    | { type: '(' | ')' }
    | { type: ':' | '*'; nameIndex: number }
}
type Match = PartPattern.Match
type Token = PartPattern.Token

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
  readonly type: 'protocol' | 'hostname' | 'pathname'
  readonly ignoreCase: boolean

  #variants: Array<Variant> | undefined
  #regexp: RegExp | undefined

  constructor(
    ast: AST,
    options: { type: 'protocol' | 'hostname' | 'pathname'; ignoreCase: boolean },
  ) {
    this.tokens = ast.tokens
    this.paramNames = ast.paramNames
    this.optionals = ast.optionals
    this.type = options.type
    this.ignoreCase = options.ignoreCase
  }

  get separator(): '.' | '/' | '' {
    return separatorForType(this.type)
  }

  static parse(
    source: string,
    options: { span?: Span; type: 'protocol' | 'hostname' | 'pathname'; ignoreCase: boolean },
  ): PartPattern {
    let span = options.span ?? [0, source.length]
    let separator = separatorForType(options.type)

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

      if (separator && char === separator) {
        ast.tokens.push({ type: 'separator' })
        i += 1
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

    return new PartPattern(ast, { type: options.type, ignoreCase: options.ignoreCase })
  }

  get variants(): Array<Variant> {
    if (this.#variants === undefined) {
      this.#variants = Variant.generate(this)
    }

    return this.#variants
  }

  get source(): string {
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

      if (token.type === 'separator') {
        result += this.separator
        continue
      }

      unreachable(token.type)
    }

    return result
  }

  toString(): string {
    return this.source
  }

  /**
   * @param params The parameters to substitute into the pattern.
   * @returns The href (URL) for the given params, or null if no variant matches.
   */
  href(params: Record<string, string | number>): string | null {
    let best: Variant | undefined
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
      if (token.type === 'separator') {
        result += this.separator
        continue
      }
      unreachable(token.type)
    }
    return result
  }

  match(part: string): Match | null {
    if (this.#regexp === undefined) {
      this.#regexp = toRegExp(this.tokens, this.separator, this.ignoreCase)
    }
    let reMatch = this.#regexp.exec(part)
    if (reMatch === null) return null
    let match: Match = []
    for (let group in reMatch.indices?.groups) {
      let prefix = group[0]
      let nameIndex = parseInt(group.slice(1))
      if (prefix !== 'v' && prefix !== 'w') continue
      let type: ':' | '*' = prefix === 'v' ? ':' : '*'
      let span = reMatch.indices.groups[group]
      if (span === undefined) continue
      match.push({
        type,
        name: this.paramNames[nameIndex],
        begin: span[0],
        end: span[1],
        value: reMatch.groups![group],
      })
    }
    return match
  }
}

function toRegExp(tokens: Array<Token>, separator: '.' | '/' | '', ignoreCase: boolean): RegExp {
  let result = ''
  for (let token of tokens) {
    if (token.type === 'text') {
      result += escapeRegex(token.text)
      continue
    }

    if (token.type === ':') {
      result += `(?<v${token.nameIndex}>`
      result += separator ? `[^${separator}]+?` : `.+?`
      result += `)`
      continue
    }

    if (token.type === '*') {
      result += `(?<w${token.nameIndex}>.*)`
      continue
    }

    if (token.type === '(') {
      result += '(?:'
      continue
    }

    if (token.type === ')') {
      result += ')?'
      continue
    }

    if (token.type === 'separator') {
      result += escapeRegex(separator ?? '')
      continue
    }

    unreachable(token.type)
  }
  return new RegExp(`^${result}$`, ignoreCase ? 'di' : 'd')
}

function separatorForType(type: 'protocol' | 'hostname' | 'pathname'): '.' | '/' | '' {
  if (type === 'hostname') return '.'
  if (type === 'pathname') return '/'
  return ''
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')
}
