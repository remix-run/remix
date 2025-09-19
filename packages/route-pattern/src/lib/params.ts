import type { ParseResult, Parse, TokenList, Token, Optional } from './parse.ts'

type Simplify<T> = T extends {} ? { [K in keyof T]: T[K] } : T

/**
 * The parameters that are parsed when a pattern matches a URL.
 */
export type Params<T extends string> = Simplify<
  Record<RequiredParams<T>, string> & Record<OptionalParams<T>, string | undefined>
>

// prettier-ignore
export type RequiredParams<T extends string> =
  Parse<T> extends infer A extends ParseResult ?
    | RequiredPartParams<A['protocol']>
    | RequiredPartParams<A['pathname']>
    | RequiredPartParams<A['hostname']> :
  never

// prettier-ignore
type RequiredPartParams<T extends TokenList | undefined> =
  T extends [infer Head extends Token, ...infer Tail extends TokenList] ?
    Head extends Optional ? never | RequiredPartParams<Tail> :
    Head extends { type: 'variable' | 'wildcard', name: infer N extends string } ? N | RequiredPartParams<Tail> :
    Head extends { type: 'wildcard' } ? '*' | RequiredPartParams<Tail> :
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
type OptionalPartParams<T extends TokenList | undefined, IsOptional extends boolean = false> =
  T extends [infer Head extends Token, ...infer Tail extends TokenList] ?
    Head extends Optional ? OptionalPartParams<Head['tokens'], true> | OptionalPartParams<Tail, IsOptional> :
    Head extends { type: 'variable' | 'wildcard', name: infer N extends string } ? (IsOptional extends true ? N | OptionalPartParams<Tail, true> : OptionalPartParams<Tail, IsOptional>) :
    Head extends { type: 'wildcard' } ? (IsOptional extends true ? '*' | OptionalPartParams<Tail, true> : OptionalPartParams<Tail, IsOptional>) :
    OptionalPartParams<Tail, IsOptional> :
  never
