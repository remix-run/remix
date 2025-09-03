import type { Ast, Parse, Part, PartNode } from './parse.types.ts'

type Simplify<T> = T extends {} ? { [K in keyof T]: T[K] } : T

/**
 * The parameters that are parsed when a pattern matches a URL.
 */
// prettier-ignore
export type Params<T extends string> =
  Simplify<Record<RequiredParams<T>, string> & Record<OptionalParams<T>, string | undefined>>

// prettier-ignore
export type RequiredParams<T extends string> =
  Parse<T> extends infer A extends Ast ?
    | (A['protocol'] extends Part ? RequiredPartParams<A['protocol']> : never)
    | (A['pathname'] extends Part ? RequiredPartParams<A['pathname']> : never)
    | (A['hostname'] extends Part ? RequiredPartParams<A['hostname']> : never) :
    never

// prettier-ignore
type RequiredPartParams<T extends Part> =
  T extends [infer L extends PartNode, ...infer R extends Part] ?
    L extends PartNode<'optional'> ? never | RequiredPartParams<R> :
    L extends { type: 'variable', name: infer N extends string } ? N | RequiredPartParams<R> :
    L extends { type: 'wildcard', name: infer N extends string } ? N | RequiredPartParams<R> :
    L extends { type: 'wildcard' } ? '*' | RequiredPartParams<R> :
    RequiredPartParams<R> :
    never

// prettier-ignore
export type OptionalParams<T extends string> =
  Parse<T> extends infer A extends Ast ?
    | (A['protocol'] extends Part ? OptionalPartParams<A['protocol']> : never)
    | (A['pathname'] extends Part ? OptionalPartParams<A['pathname']> : never)
    | (A['hostname'] extends Part ? OptionalPartParams<A['hostname']> : never) :
    never

// prettier-ignore
type OptionalPartParams<T extends Part, IsOptional extends boolean = false> =
  T extends [infer L extends PartNode, ...infer R extends Part] ?
    L extends PartNode<'optional'> ? OptionalPartParams<L['nodes'], true> | OptionalPartParams<R, IsOptional> :
    L extends { type: 'variable', name: infer N extends string } ? (IsOptional extends true ? N | OptionalPartParams<R, true> : OptionalPartParams<R, IsOptional>) :
    L extends { type: 'wildcard', name: infer N extends string } ? (IsOptional extends true ? N | OptionalPartParams<R, true> : OptionalPartParams<R, IsOptional>) :
    L extends { type: 'wildcard' } ? (IsOptional extends true ? '*' | OptionalPartParams<R, true> : OptionalPartParams<R, IsOptional>) :
    OptionalPartParams<R, IsOptional> :
    never
