import { split } from './split.ts'
import type { SplitResult, Split } from './split.ts'

export class ParseError extends Error {
  source: string
  position: number
  partName: string

  constructor(message: string, source: string, position: number, partName: string) {
    super(`${message}${partName ? ` in ${partName}` : ''}`)
    this.name = 'ParseError'
    this.source = source
    this.position = position
    this.partName = partName
  }
}

export function parse(source: string) {
  let result: ParseResult = {}

  let { protocol, hostname, port, pathname, search } = split(source) as SplitResult
  let start = 0

  if (protocol) {
    start = source.indexOf(protocol, start)
    result.protocol = parsePart(source, start, protocol.length, 'protocol')
    start += protocol.length
  }
  if (hostname) {
    start = source.indexOf(hostname, start)
    result.hostname = parsePart(source, start, hostname.length, 'hostname')
    start += hostname.length
  }
  if (port) {
    result.port = port
    start = source.indexOf(port, start) + port.length
  }
  if (pathname) {
    start = source.indexOf(pathname, start)
    result.pathname = parsePart(source, start, pathname.length, 'pathname')
  }
  if (search) {
    result.search = search
  }

  return result
}

const identifierMatcher = /^[a-zA-Z_$][a-zA-Z_$0-9]*/

function parsePart(source: string, start: number, length: number, partName: string) {
  let tokens: TokenList = []
  // Use a simple stack of token arrays: the top is where new tokens are appended.
  // The root of the stack is the `part` array. Each '(' pushes a new array; ')'
  // pops and wraps it in an optional token which is appended to the new top.
  let tokensStack: Array<Array<Token>> = [tokens]
  let openIndexes: Array<number> = []
  let currentTokens = () => tokensStack[tokensStack.length - 1]

  let appendText = (text: string) => {
    let last = currentTokens().at(-1)
    if (last?.type !== 'text') {
      currentTokens().push({ type: 'text', value: text })
      return
    }
    last.value += text
  }

  let i = start
  let end = start + length
  while (i < end) {
    let char = source[i]

    // variable
    if (char === ':') {
      i += 1
      let remaining = source.slice(i, end)
      let name = identifierMatcher.exec(remaining)?.[0]
      if (!name) throw new ParseError('missing variable name', source, i, partName)
      currentTokens().push({ type: 'variable', name })
      i += name.length
      continue
    }

    // wildcard
    if (char === '*') {
      i += 1
      let remaining = source.slice(i, end)
      let name = identifierMatcher.exec(remaining)?.[0]
      if (name) {
        currentTokens().push({ type: 'wildcard', name })
        i += name.length
      } else {
        currentTokens().push({ type: 'wildcard' })
      }
      continue
    }

    // enum
    if (char === '{') {
      let close = source.indexOf('}', i)
      if (close === -1 || close >= end) throw new ParseError('unmatched {', source, i, partName)
      let members = source.slice(i + 1, close).split(',')
      currentTokens().push({ type: 'enum', members })
      i = close + 1
      continue
    }
    if (char === '}') {
      throw new ParseError('unmatched }', source, i, partName)
    }

    // optional
    if (char === '(') {
      tokensStack.push([])
      openIndexes.push(i)
      i += 1
      continue
    }
    if (char === ')') {
      if (tokensStack.length === 1) throw new ParseError('unmatched )', source, i, partName)
      let tokens = tokensStack.pop()!
      openIndexes.pop()
      currentTokens().push({ type: 'optional', tokens })
      i += 1
      continue
    }

    // text
    if (char === '\\') {
      let next = source.at(i + 1)
      if (!next || i + 1 >= end) throw new ParseError('dangling escape', source, i, partName)
      appendText(next)
      i += 2
      continue
    }

    appendText(char)
    i += 1
  }

  if (openIndexes.length > 0) {
    // Report the position of the earliest unmatched '('
    throw new ParseError('unmatched (', source, openIndexes[0], partName)
  }

  return tokens
}

// Search parsing helpers ---------------------------------------------------------------------------

export function parseSearchConstraints(search: string): SearchConstraints {
  let constraints: SearchConstraints = new Map()

  for (let part of search.split('&')) {
    if (part === '') continue
    let eqIndex = part.indexOf('=')
    if (eqIndex === -1) {
      // Presence-only (no '=')
      let name = decodeSearchComponent(part)
      let existing = constraints.get(name)
      if (!existing) {
        constraints.set(name, { requireAssignment: false, allowBare: true })
      }
      continue
    }

    let name = decodeSearchComponent(part.slice(0, eqIndex))
    let valuePart = part.slice(eqIndex + 1)
    let existing = constraints.get(name)
    if (!existing) {
      existing = { requireAssignment: true, allowBare: false }
      constraints.set(name, existing)
    } else {
      existing.requireAssignment = true
      existing.allowBare = false
    }

    if (valuePart.length > 0) {
      let decodedValue = decodeSearchComponent(valuePart)
      if (!existing.requiredValues) existing.requiredValues = new Set<string>()
      existing.requiredValues.add(decodedValue)
    }
  }

  return constraints
}

export function parseSearch(search: string): {
  namesWithoutAssignment: Set<string>
  namesWithAssignment: Set<string>
  valuesByKey: Map<string, Set<string>>
} {
  if (search.startsWith('?')) search = search.slice(1)

  let namesWithoutAssignment = new Set<string>()
  let namesWithAssignment = new Set<string>()
  let valuesByKey = new Map<string, Set<string>>()

  if (search.length > 0) {
    for (let part of search.split('&')) {
      if (part === '') continue
      let eqIndex = part.indexOf('=')
      if (eqIndex === -1) {
        let name = decodeSearchComponent(part)
        namesWithoutAssignment.add(name)
        continue
      }

      let name = decodeSearchComponent(part.slice(0, eqIndex))
      let valuePart = part.slice(eqIndex + 1)
      namesWithAssignment.add(name)
      let value = decodeSearchComponent(valuePart)
      let set = valuesByKey.get(name)
      if (!set) {
        set = new Set<string>()
        valuesByKey.set(name, set)
      }
      set.add(value)
    }
  }

  return { namesWithoutAssignment, namesWithAssignment, valuesByKey }
}

function decodeSearchComponent(text: string): string {
  try {
    return decodeURIComponent(text.replace(/\+/g, ' '))
  } catch {
    return text
  }
}

export interface ParseResult {
  protocol?: TokenList
  hostname?: TokenList
  port?: string
  pathname?: TokenList
  search?: string
}

// prettier-ignore
export type Parse<T extends string> =
  T extends any ?
    Split<T> extends infer S extends SplitResult ?
      {
        protocol: S['protocol'] extends string ? PartParse<S['protocol']> : undefined
        hostname: S['hostname'] extends string ? PartParse<S['hostname']> : undefined
        port: S['port'] extends string ? string : undefined
        pathname: S['pathname'] extends string ? PartParse<S['pathname']> : undefined
        search: S['search'] extends string ? string : undefined
      } :
      never :
  never

export type Variable = { type: 'variable'; name: string }
export type Wildcard = { type: 'wildcard'; name?: string }
export type Enum = { type: 'enum'; members: readonly string[] }
export type Text = { type: 'text'; value: string }
export type Optional = { type: 'optional'; tokens: TokenList }

export type Token = Variable | Wildcard | Enum | Text | Optional
export type TokenList = Array<Token>

type PartParseState = {
  tokens: TokenList
  optionals: Array<TokenList>
  rest: string
}

type PartParse<T extends string> = _PartParse<{
  tokens: []
  optionals: []
  rest: T
}>

// prettier-ignore
type _PartParse<S extends PartParseState> =
  S extends { rest: `${infer Head}${infer Tail}` } ?
    Head extends ':' ?
      IdentiferParse<Tail> extends { identifier: infer name extends string, rest: infer rest extends string } ?
        (name extends '' ? never : _PartParse<AppendToken<S, { type: 'variable', name: name }, rest>>) :
      never : // this should never happen
    Head extends '*' ?
      IdentiferParse<Tail> extends { identifier: infer name extends string, rest: infer rest extends string } ?
        _PartParse<AppendToken<S, (name extends '' ? { type: 'wildcard' } : { type: 'wildcard', name: name }), rest>> :
      never : // this should never happen
    Head extends '{' ?
      Tail extends `${infer body}}${infer after}` ?
        _PartParse<AppendToken<S, { type: 'enum', members: EnumSplit<body> }, after>> :
      never : // unmatched `{`
    Head extends '}' ?
      never : // unmatched `}`
    Head extends '(' ?
      _PartParse<PushOptional<S, Tail>> :
    Head extends ')' ?
      PopOptional<S, Tail> extends infer next extends PartParseState ? _PartParse<next> : never : // unmatched `)` handled in PopOptional
    Head extends '\\' ?
      Tail extends `${infer L}${infer R}` ? _PartParse<AppendText<S, L, R>> :
      never : // dangling escape
    _PartParse<AppendText<S, Head, Tail>> :
  S['optionals'] extends [] ? S['tokens'] :
  never // unmatched `(`

// prettier-ignore
type AppendToken<S extends PartParseState, token extends Token, rest extends string> =
  S['optionals'] extends [...infer O extends Array<Array<Token>>, infer Top extends Array<Token>] ?
    {
      tokens: S['tokens']
      optionals: [...O, [...Top, token]]
      rest: rest
    } :
    {
      tokens: [...S['tokens'], token]
      optionals: S['optionals']
      rest: rest;
    }

// prettier-ignore
type AppendText<S extends PartParseState, text extends string, rest extends string> =
  S['optionals'] extends [...infer O extends Array<Array<Token>>, infer Top extends Array<Token>] ?
    (
      Top extends [...infer Tokens extends Array<Token>, { type: 'text', value: infer value extends string }] ?
        { tokens: S['tokens']; optionals: [...O, [...Tokens, { type: 'text', value: `${value}${text}` }]]; rest: rest } :
        { tokens: S['tokens']; optionals: [...O, [...Top, { type: 'text', value: text }]]; rest: rest }
    ) :
    (
      S['tokens'] extends [...infer Tokens extends Array<Token>, { type: 'text', value: infer value extends string }] ?
        { tokens: [...Tokens, { type: 'text', value: `${value}${text}` }]; optionals: S['optionals']; rest: rest } :
        { tokens: [...S['tokens'], { type: 'text', value: text }]; optionals: S['optionals']; rest: rest }
    )

// Optional stack helpers ---------------------------------------------------------------------------

type PushOptional<S extends PartParseState, rest extends string> = {
  tokens: S['tokens']
  optionals: [...S['optionals'], []]
  rest: rest
}

// If stack is empty -> unmatched ')', return never
// Else pop and wrap tokens into an Optional token; append to parent or part
type PopOptional<S extends PartParseState, R extends string> = S['optionals'] extends [
  ...infer O extends Array<Array<Token>>,
  infer Top extends Array<Token>,
]
  ? O extends [...infer OO extends Array<Array<Token>>, infer Parent extends Array<Token>]
    ? {
        tokens: S['tokens']
        optionals: [...OO, [...Parent, { type: 'optional'; tokens: Top }]]
        rest: R
      }
    : { tokens: [...S['tokens'], { type: 'optional'; tokens: Top }]; optionals: []; rest: R }
  : never

// Identifier --------------------------------------------------------------------------------------

// prettier-ignore
type _a_z = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm' | 'n' | 'o' | 'p' | 'q' | 'r' | 's' | 't' | 'u' | 'v' | 'w' | 'x' | 'y' | 'z'
type _A_Z = Uppercase<_a_z>
type _0_9 = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

type IdentifierHead = _a_z | _A_Z | '_' | '$'
type IdentifierTail = IdentifierHead | _0_9

type IdentiferParse<T extends string> = _IdentifierParse<{ identifier: ''; rest: T }>

// prettier-ignore
type _IdentifierParse<S extends { identifier: string, rest: string }> =
  S extends { identifier: '', rest: `${infer Head extends IdentifierHead}${infer Tail}` } ?
    _IdentifierParse<{ identifier: Head, rest: Tail }> :
    S extends { identifier: string, rest: `${infer Head extends IdentifierTail}${infer Tail}`} ?
      _IdentifierParse<{ identifier: `${S['identifier']}${Head}`, rest: Tail }> :
      S

// Enum --------------------------------------------------------------------------------------------

// prettier-ignore
type EnumSplit<Body extends string> =
  Body extends `${infer Member},${infer Rest}` ? [Member, ...EnumSplit<Rest>] :
  [Body]

// Search constraints ------------------------------------------------------------------------------

export type SearchConstraints = Map<
  string,
  { requiredValues?: Set<string>; requireAssignment: boolean; allowBare: boolean }
>
