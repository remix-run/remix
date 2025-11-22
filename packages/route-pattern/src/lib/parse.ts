import { split, type SplitPattern, type Split } from './split.ts'
import { parseSearchConstraints, type SearchConstraints } from './search-constraints.ts'

export class ParseError extends Error {
  source: string
  position: number
  partName: string

  constructor(description: string, partName: string, source: string, position: number) {
    super(`${description} in ${partName}`)
    this.name = 'ParseError'
    this.source = source
    this.position = position
    this.partName = partName
  }
}

export interface ParseResult {
  protocol: Array<Token> | undefined
  hostname: Array<Token> | undefined
  port: string | undefined
  pathname: Array<Token> | undefined
  search: string | undefined
  searchConstraints: SearchConstraints | undefined
}

export function parse<T extends string>(source: T): ParseResult {
  let protocol: Token[] | undefined
  let hostname: Token[] | undefined
  let port: string | undefined
  let pathname: Token[] | undefined
  let search: string | undefined
  let searchConstraints: SearchConstraints | undefined

  let ranges = split(source)

  if (ranges.protocol) {
    protocol = parsePart('protocol', '', source, ...ranges.protocol)
  }
  if (ranges.hostname) {
    hostname = parsePart('hostname', '.', source, ...ranges.hostname)
  }
  if (ranges.port) {
    port = source.slice(...ranges.port)
  }
  if (ranges.pathname) {
    pathname = parsePart('pathname', '/', source, ...ranges.pathname)
  }
  if (ranges.search) {
    search = source.slice(...ranges.search)
    searchConstraints = parseSearchConstraints(search)
  }

  return { protocol, hostname, port, pathname, search, searchConstraints }
}

const identifierMatcher = /^[a-zA-Z_$][a-zA-Z_$0-9]*/

function parsePart(partName: string, sep: string, source: string, start: number, end: number) {
  let tokens: Token[] = []
  let currentTokens = tokens
  // Use a simple stack of token arrays: the top is where new tokens are appended.
  // The root of the stack is the `part` array. Each '(' pushes a new array; ')'
  // pops and wraps it in an optional token which is appended to the new top.
  let tokensStack: Array<Token[]> = [tokens]
  let openIndexes: Array<number> = []

  let appendText = (text: string) => {
    let lastToken = currentTokens.at(-1)
    if (lastToken?.type === 'text') {
      lastToken.value += text
    } else {
      currentTokens.push({ type: 'text', value: text })
    }
  }

  let i = start
  while (i < end) {
    let char = source[i]

    // separator
    if (char === sep) {
      currentTokens.push({ type: 'separator' })
      i += 1
      continue
    }

    // variable
    if (char === ':') {
      i += 1
      let remaining = source.slice(i, end)
      let name = identifierMatcher.exec(remaining)?.[0]
      if (!name) throw new ParseError('missing variable name', partName, source, i)
      currentTokens.push({ type: 'variable', name })
      i += name.length
      continue
    }

    // wildcard
    if (char === '*') {
      i += 1
      let remaining = source.slice(i, end)
      let name = identifierMatcher.exec(remaining)?.[0]
      if (name) {
        currentTokens.push({ type: 'wildcard', name })
        i += name.length
      } else {
        currentTokens.push({ type: 'wildcard' })
      }
      continue
    }

    // optional
    if (char === '(') {
      tokensStack.push((currentTokens = []))
      openIndexes.push(i)
      i += 1
      continue
    }
    if (char === ')') {
      if (tokensStack.length === 1) throw new ParseError('unmatched )', partName, source, i)
      let tokens = tokensStack.pop()!
      currentTokens = tokensStack[tokensStack.length - 1]
      currentTokens.push({ type: 'optional', tokens })
      openIndexes.pop()
      i += 1
      continue
    }

    // text
    if (char === '\\') {
      let next = source.at(i + 1)
      if (!next || i + 1 >= end) throw new ParseError('dangling escape', partName, source, i)
      appendText(next)
      i += 2
      continue
    }

    appendText(char)
    i += 1
  }

  if (openIndexes.length > 0) {
    // Report the position of the earliest unmatched '('
    throw new ParseError('unmatched (', partName, source, openIndexes[0])
  }

  return tokens
}

export interface ParsedPattern {
  protocol: Token[] | undefined
  hostname: Token[] | undefined
  port: string | undefined
  pathname: Token[] | undefined
  search: string | undefined
}

// prettier-ignore
export type Parse<T extends string> =
  [T] extends [string] ?
    Split<T> extends infer S extends SplitPattern ?
      {
        protocol: S['protocol'] extends string ? ParsePart<S['protocol']> : undefined
        hostname: S['hostname'] extends string ? ParsePart<S['hostname'], '.'> : undefined
        port: S['port'] extends string ? S['port'] : undefined
        pathname: S['pathname'] extends string ? ParsePart<S['pathname'], '/'> : undefined
        search: S['search'] extends string ? S['search'] : undefined
      } :
      never :
    never

export type Variable = { type: 'variable'; name: string }
export type Wildcard = { type: 'wildcard'; name?: string }
export type Text = { type: 'text'; value: string }
export type Separator = { type: 'separator' }
export type Optional = { type: 'optional'; tokens: Token[] }

export type Token = Variable | Wildcard | Text | Separator | Optional

type ParsePartState = {
  tokens: Token[]
  optionals: Array<Token[]>
  rest: string
}

type ParsePart<T extends string, Sep extends string = ''> = _ParsePart<
  {
    tokens: []
    optionals: []
    rest: T
  },
  Sep
>

// prettier-ignore
type _ParsePart<S extends ParsePartState, Sep extends string = ''> =
  S extends { rest: `${infer Head}${infer Tail}` } ?
    Head extends Sep ? _ParsePart<AppendToken<S, { type: 'separator' }, Tail>, Sep> :
    Head extends ':' ?
      IdentifierParse<Tail> extends { identifier: infer name extends string, rest: infer rest extends string } ?
        (name extends '' ? never : _ParsePart<AppendToken<S, { type: 'variable', name: name }, rest>, Sep>) :
      never : // this should never happen
    Head extends '*' ?
      IdentifierParse<Tail> extends { identifier: infer name extends string, rest: infer rest extends string } ?
        _ParsePart<AppendToken<S, (name extends '' ? { type: 'wildcard' } : { type: 'wildcard', name: name }), rest>, Sep> :
      never : // this should never happen
    Head extends '(' ? _ParsePart<PushOptional<S, Tail>, Sep> :
    Head extends ')' ?
      PopOptional<S, Tail> extends infer next extends ParsePartState ? _ParsePart<next, Sep> :
      never : // unmatched `)` handled in PopOptional
    Head extends '\\' ?
      Tail extends `${infer L}${infer R}` ? _ParsePart<AppendText<S, L, R>, Sep> :
      never : // dangling escape
    _ParsePart<AppendText<S, Head, Tail>, Sep> :
  S['optionals'] extends [] ? S['tokens'] :
  never // unmatched `(`

// prettier-ignore
type AppendToken<S extends ParsePartState, token extends Token, rest extends string> =
  S['optionals'] extends [...infer O extends Array<Token[]>, infer Top extends Token[]] ?
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
type AppendText<S extends ParsePartState, text extends string, rest extends string> =
  S['optionals'] extends [...infer O extends Array<Token[]>, infer Top extends Token[]] ?
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

type PushOptional<S extends ParsePartState, rest extends string> = {
  tokens: S['tokens']
  optionals: [...S['optionals'], []]
  rest: rest
}

// If stack is empty -> unmatched ')', return never
// Else pop and wrap tokens into an Optional token; append to parent or part
type PopOptional<S extends ParsePartState, R extends string> = S['optionals'] extends [
  ...infer O extends Array<Token[]>,
  infer Top extends Array<Token>,
]
  ? O extends [...infer OO extends Array<Token[]>, infer Parent extends Token[]]
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

type IdentifierParse<T extends string> = _IdentifierParse<{ identifier: ''; rest: T }>

// prettier-ignore
type _IdentifierParse<S extends { identifier: string, rest: string }> =
  S extends { identifier: '', rest: `${infer Head extends IdentifierHead}${infer Tail}` } ?
    _IdentifierParse<{ identifier: Head, rest: Tail }> :
    S extends { identifier: string, rest: `${infer Head extends IdentifierTail}${infer Tail}`} ?
      _IdentifierParse<{ identifier: `${S['identifier']}${Head}`, rest: Tail }> :
      S
