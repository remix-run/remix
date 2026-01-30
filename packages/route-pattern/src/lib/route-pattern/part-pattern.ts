import { ParseError } from './parse.ts'
import { unreachable } from '../unreachable.ts'
import * as RE from '../regexp.ts'
import type { Span } from './split.ts'

type MatchParam = {
  type: ':' | '*'
  name: string
  value: string
  begin: number
  end: number
}

export type PartPatternMatch = Array<MatchParam>
export type PartPatternToken =
  | { type: 'text'; text: string }
  | { type: 'separator' }
  | { type: '(' | ')' }
  | { type: ':' | '*'; name: string }

const IDENTIFIER_RE = /^[a-zA-Z_$][a-zA-Z_$0-9]*/

export class PartPattern {
  readonly tokens: Array<PartPatternToken>
  readonly optionals: Map<number, number>
  readonly type: 'hostname' | 'pathname'
  readonly ignoreCase: boolean

  #regexp: RegExp | undefined

  constructor(
    args: {
      tokens: Array<PartPatternToken>
      optionals: Map<number, number>
    },
    options: { type: 'hostname' | 'pathname'; ignoreCase: boolean },
  ) {
    this.tokens = args.tokens
    this.optionals = args.optionals
    this.type = options.type
    this.ignoreCase = options.ignoreCase
  }

  get params(): Array<Extract<PartPatternToken, { type: ':' | '*' }>> {
    let result: Array<Extract<PartPatternToken, { type: ':' | '*' }>> = []
    for (let token of this.tokens) {
      if (token.type === ':' || token.type === '*') {
        result.push(token)
      }
    }
    return result
  }

  get separator(): '.' | '/' {
    return separatorForType(this.type)
  }

  static parse(
    source: string,
    options: { span?: Span; type: 'hostname' | 'pathname'; ignoreCase: boolean },
  ): PartPattern {
    let span = options.span ?? [0, source.length]
    let separator = separatorForType(options.type)

    let tokens: Array<PartPatternToken> = []
    let optionals: Map<number, number> = new Map()

    let appendText = (text: string) => {
      let currentToken = tokens.at(-1)
      if (currentToken?.type === 'text') {
        currentToken.text += text
      } else {
        tokens.push({ type: 'text', text })
      }
    }

    let i = span[0]
    let optionalStack: Array<number> = []
    while (i < span[1]) {
      let char = source[i]

      // optional begin
      if (char === '(') {
        optionalStack.push(tokens.length)
        tokens.push({ type: char })
        i += 1
        continue
      }

      // optional end
      if (char === ')') {
        let begin = optionalStack.pop()
        if (begin === undefined) {
          throw new ParseError('unmatched )', source, i)
        }
        optionals.set(begin, tokens.length)
        tokens.push({ type: char })
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
        tokens.push({ type: ':', name })
        i += name.length
        continue
      }

      // wildcard
      if (char === '*') {
        i += 1
        let name = IDENTIFIER_RE.exec(source.slice(i, span[1]))?.[0]
        tokens.push({ type: '*', name: name ?? '*' })
        i += name?.length ?? 0
        continue
      }

      if (separator && char === separator) {
        tokens.push({ type: 'separator' })
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

    return new PartPattern(
      { tokens, optionals },
      { type: options.type, ignoreCase: options.ignoreCase },
    )
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
        let name = token.name === '*' ? '' : token.name
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

  match(part: string): PartPatternMatch | null {
    if (this.#regexp === undefined) {
      this.#regexp = toRegExp(this.tokens, this.separator, this.ignoreCase)
    }
    let reMatch = this.#regexp.exec(part)
    if (reMatch === null) return null
    let match: PartPatternMatch = []
    let params = this.params
    for (let i = 0; i < params.length; i++) {
      let param = params[i]
      let captureIndex = i + 1
      let span = reMatch.indices?.[captureIndex]
      if (span === undefined) continue
      match.push({
        type: param.type,
        name: param.name,
        begin: span[0],
        end: span[1],
        value: reMatch[captureIndex],
      })
    }
    return match
  }
}

function toRegExp(
  tokens: Array<PartPatternToken>,
  separator: '.' | '/',
  ignoreCase: boolean,
): RegExp {
  let result = ''
  for (let token of tokens) {
    if (token.type === 'text') {
      result += RE.escape(token.text)
      continue
    }

    if (token.type === ':') {
      result += separator ? `([^${separator}]+?)` : `(.+?)`
      continue
    }

    if (token.type === '*') {
      result += `(.*)`
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
      result += RE.escape(separator ?? '')
      continue
    }

    unreachable(token.type)
  }
  return new RegExp(`^${result}$`, ignoreCase ? 'di' : 'd')
}

function separatorForType(type: 'hostname' | 'pathname'): '.' | '/' {
  if (type === 'hostname') return '.'
  return '/'
}
