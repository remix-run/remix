import type { ParseResult, Parse, NodeList, Node, Optional } from './parse.types.ts'

type Simplify<T> = T extends {} ? { [K in keyof T]: T[K] } : T

/**
 * The parameters that are parsed when a pattern matches a URL.
 */
// prettier-ignore
export type Params<T extends string> =
  Simplify<Record<RequiredParams<T>, string> & Record<OptionalParams<T>, string | undefined>>

// prettier-ignore
export type RequiredParams<T extends string> =
  Parse<T> extends infer A extends ParseResult ?
    | (A['protocol'] extends NodeList ? RequiredPartParams<A['protocol']> : never)
    | (A['pathname'] extends NodeList ? RequiredPartParams<A['pathname']> : never)
    | (A['hostname'] extends NodeList ? RequiredPartParams<A['hostname']> : never) :
    never

// prettier-ignore
type RequiredPartParams<T extends NodeList> =
  T extends [infer L extends Node, ...infer R extends NodeList] ?
    L extends Optional ? never | RequiredPartParams<R> :
    L extends { type: 'variable', name: infer N extends string } ? N | RequiredPartParams<R> :
    L extends { type: 'wildcard', name: infer N extends string } ? N | RequiredPartParams<R> :
    L extends { type: 'wildcard' } ? '*' | RequiredPartParams<R> :
    RequiredPartParams<R> :
    never

// prettier-ignore
export type OptionalParams<T extends string> =
  Parse<T> extends infer A extends ParseResult ?
    | (A['protocol'] extends NodeList ? OptionalPartParams<A['protocol']> : never)
    | (A['pathname'] extends NodeList ? OptionalPartParams<A['pathname']> : never)
    | (A['hostname'] extends NodeList ? OptionalPartParams<A['hostname']> : never) :
    never

// prettier-ignore
type OptionalPartParams<T extends NodeList, IsOptional extends boolean = false> =
  T extends [infer L extends Node, ...infer R extends NodeList] ?
    L extends Optional ? OptionalPartParams<L['nodes'], true> | OptionalPartParams<R, IsOptional> :
    L extends { type: 'variable', name: infer N extends string } ? (IsOptional extends true ? N | OptionalPartParams<R, true> : OptionalPartParams<R, IsOptional>) :
    L extends { type: 'wildcard', name: infer N extends string } ? (IsOptional extends true ? N | OptionalPartParams<R, true> : OptionalPartParams<R, IsOptional>) :
    L extends { type: 'wildcard' } ? (IsOptional extends true ? '*' | OptionalPartParams<R, true> : OptionalPartParams<R, IsOptional>) :
    OptionalPartParams<R, IsOptional> :
    never
