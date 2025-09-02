import type { Ast, Parse, Part, PartNode } from './parse.types.ts'
import type { IsEqual, Pretty } from './type-utils'

export type Params<T extends string> =
  _Params<T> extends infer P ? (IsEqual<P, {}> extends true ? Record<string, never> : P) : never

// prettier-ignore
type _Params<T extends string> =
  Parse<T> extends infer A extends Ast ? Pretty<
    { [K in RequiredParams<A>]: string } &
    { [K in OptionalParams<A>]?: string }
  > :
  never

// prettier-ignore
type RequiredParams<A extends Ast> =
  | (A['protocol'] extends Part ? RequiredPartParams<A['protocol']> : never)
  | (A['pathname'] extends Part ? RequiredPartParams<A['pathname']> : never)
  | (A['hostname'] extends Part ? RequiredPartParams<A['hostname']> : never)

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
type OptionalParams<A extends Ast> =
  | (A['protocol'] extends Part ? OptionalPartParams<A['protocol']> : never)
  | (A['pathname'] extends Part ? OptionalPartParams<A['pathname']> : never)
  | (A['hostname'] extends Part ? OptionalPartParams<A['hostname']> : never)

// prettier-ignore
type OptionalPartParams<T extends Part, IsOptional extends boolean = false> =
  T extends [infer L extends PartNode, ...infer R extends Part] ?
    L extends PartNode<'optional'> ? OptionalPartParams<L['nodes'], true> | OptionalPartParams<R, IsOptional> :
    L extends { type: 'variable', name: infer N extends string } ? (IsOptional extends true ? N | OptionalPartParams<R, true> : OptionalPartParams<R, IsOptional>) :
    L extends { type: 'wildcard', name: infer N extends string } ? (IsOptional extends true ? N | OptionalPartParams<R, true> : OptionalPartParams<R, IsOptional>) :
    L extends { type: 'wildcard' } ? (IsOptional extends true ? '*' | OptionalPartParams<R, true> : OptionalPartParams<R, IsOptional>) :
    OptionalPartParams<R, IsOptional> :
  never
