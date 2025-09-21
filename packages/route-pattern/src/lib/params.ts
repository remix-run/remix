import type { ParseResult, Parse, Token, Optional } from './parse.ts'

/**
 * The parameters that are parsed when a pattern matches a URL.
 */
export type Params<T extends string> = Simplify<
  Record<RequiredParams<T>, string> & Record<OptionalParams<T>, string | undefined>
>

type Simplify<T> = T extends {} ? { [K in keyof T]: T[K] } : T

// prettier-ignore
export type RequiredParams<T extends string> =
  Parse<T> extends infer A extends ParseResult ?
    | RequiredPartParams<A['protocol']>
    | RequiredPartParams<A['pathname']>
    | RequiredPartParams<A['hostname']> :
  never

// prettier-ignore
type RequiredPartParams<T extends Token[] | undefined> =
  T extends [infer Head extends Token, ...infer Tail extends Token[]] ?
    Head extends Optional ? never | RequiredPartParams<Tail> :
    Head extends { type: 'variable' | 'wildcard', name: infer N extends string } ? 
      (IsTrailingWildcard<Head, Tail> extends true ? never : N) | RequiredPartParams<Tail> :
    Head extends { type: 'wildcard' } ? 
      (IsTrailingWildcard<Head, Tail> extends true ? never : '*') | RequiredPartParams<Tail> :
    RequiredPartParams<Tail> :
  never

// prettier-ignore
export type OptionalParams<T extends string> =
  Parse<T> extends infer A extends ParseResult ?
    | OptionalPartParams<A['protocol']>
    | OptionalPartParams<A['pathname']>
    | OptionalPartParams<A['hostname']> :
  never

// prettier-ignore
type OptionalPartParams<T extends Token[] | undefined, IsOptional extends boolean = false> =
  T extends [infer Head extends Token, ...infer Tail extends Token[]] ?
    Head extends Optional ? OptionalPartParams<Head['tokens'], true> | OptionalPartParams<Tail, IsOptional> :
    Head extends { type: 'variable' | 'wildcard', name: infer N extends string } ? 
      (IsOptional extends true ? N | OptionalPartParams<Tail, true> : 
       IsTrailingWildcard<Head, Tail> extends true ? N | OptionalPartParams<Tail, IsOptional> : 
       OptionalPartParams<Tail, IsOptional>) :
    Head extends { type: 'wildcard' } ? 
      (IsOptional extends true ? '*' | OptionalPartParams<Tail, true> : 
       IsTrailingWildcard<Head, Tail> extends true ? '*' | OptionalPartParams<Tail, IsOptional> : 
       OptionalPartParams<Tail, IsOptional>) :
    OptionalPartParams<Tail, IsOptional> :
  never

// Helper type to detect trailing wildcards (wildcard as last token)
// prettier-ignore
type IsTrailingWildcard<Head extends Token, Tail extends Token[]> =
  Head extends { type: 'wildcard' } ? Tail extends [] ? true : false : false
