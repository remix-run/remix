import type { Split, SplitPattern } from './split'
import type { ForceDistributive } from './utils'

export interface ParsedPattern {
  protocol: Token[] | undefined
  hostname: Token[] | undefined
  port: string | undefined
  pathname: Token[] | undefined
  search: string | undefined
}

// prettier-ignore
export type Parse<T extends string> =
  T extends ForceDistributive ?
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
