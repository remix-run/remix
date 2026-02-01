import type { ParsedPattern, Token } from './parse'

// prettier-ignore
export type Stringify<T extends ParsedPattern> =
  T['hostname'] extends Token[] ?
    `${StringifyTokens<T['protocol'], ''>}://${StringifyTokens<T['hostname'], '.'>}${StringifyPort<T['port']>}${StringifyPathname<T['pathname']>}${StringifySearch<T['search']>}` :
    `${StringifyPathname<T['pathname']>}${StringifySearch<T['search']>}`

// prettier-ignore
type StringifyTokens<T extends Token[] | undefined, Sep extends string> =
  T extends undefined ? '' :
  T extends [] ? '' :
  T extends [infer Head extends Token, ...infer Tail extends Token[]] ?
    `${StringifyToken<Head, Sep>}${StringifyTokens<Tail, Sep>}` :
    never

// prettier-ignore
type StringifyToken<T extends Token, Sep extends string> =
  T extends { type: 'text', value: infer V extends string } ? V :
  T extends { type: 'variable', name: infer N extends string } ? `:${N}` :
  T extends { type: 'wildcard', name: infer N extends string } ? `*${N}` :
  T extends { type: 'wildcard' } ? '*' :
  T extends { type: 'separator' } ? Sep :
  T extends { type: 'optional', tokens: infer Tokens extends Token[] } ? `(${StringifyTokens<Tokens, Sep>})` :
  never

// prettier-ignore
type StringifyPathname<T extends Token[] | undefined> =
  T extends undefined ? '/' :
  T extends [] ? '/' :
  T extends Token[] ?
    StartsWithSeparator<T> extends true ?
      `${StringifyTokens<T, '/'>}` :
      `/${StringifyTokens<T, '/'>}` :
    never

type StringifyPort<T extends string | undefined> = T extends string ? `:${T}` : ''

type StringifySearch<T extends string | undefined> = T extends string ? `?${T}` : ''

// prettier-ignore
export type StartsWithSeparator<T extends Token[]> =
  T extends [] ? false :
  T extends [{ type: 'separator' }, ...Token[]] ? true :
  T extends [{ type: 'optional', tokens: infer Tokens extends Token[] }, ...Token[]] ?
    StartsWithSeparator<Tokens> :
    false
