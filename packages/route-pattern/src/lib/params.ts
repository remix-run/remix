import type { Ast, Parse, Part, PartNode } from './parse.types.ts'
import type { IsEqual, Pretty } from './type-utils'

export type Params<T extends string> =
  _Params<T> extends infer P ? (IsEqual<P, {}> extends true ? Record<string, never> : P) : never

// prettier-ignore
type _Params<T extends string> =
  Parse<T> extends infer A extends Ast ? Pretty<
    { [K in RequiredParamKey<A>]: string } &
    { [K in OptionalParamKey<A>]?: string }
  > :
  never

// prettier-ignore
type RequiredParamKey<A extends Ast> =
  | (A['protocol'] extends Part ? RequiredPartParamKey<A['protocol']> : never)
  | (A['pathname'] extends Part ? RequiredPartParamKey<A['pathname']> : never)
  | (A['hostname'] extends Part ? RequiredPartParamKey<A['hostname']> : never)

// prettier-ignore
type RequiredPartParamKey<T extends Part> =
  T extends [infer L extends PartNode, ...infer R extends Part] ?
    L extends PartNode<'optional'> ? never | RequiredPartParamKey<R> :
    L extends PartNode<'variable'> ? L['name'] | RequiredPartParamKey<R> :
    L extends PartNode<'wildcard'> ? (L extends { name: string } ? L['name'] : '*') | RequiredPartParamKey<R> :
    RequiredPartParamKey<R> :
  never

// prettier-ignore
type OptionalParamKey<A extends Ast> =
  | (A['protocol'] extends Part ? OptionalPartParamKey<A['protocol']> : never)
  | (A['pathname'] extends Part ? OptionalPartParamKey<A['pathname']> : never)
  | (A['hostname'] extends Part ? OptionalPartParamKey<A['hostname']> : never)

// prettier-ignore
type OptionalPartParamKey<T extends Part, IsOptional extends boolean = false> =
  T extends [infer L extends PartNode, ...infer R extends Part] ?
    L extends PartNode<'optional'> ? OptionalPartParamKey<L['nodes'], true> | OptionalPartParamKey<R, IsOptional> :
    L extends PartNode<'variable'> ? (IsOptional extends true ? L['name'] : never) | OptionalPartParamKey<R, IsOptional> :
    L extends PartNode<'wildcard'> ? (IsOptional extends true ?
      (L extends { name: string } ? L['name'] : '*') : never) | OptionalPartParamKey<R, IsOptional> :
    OptionalPartParamKey<R, IsOptional> :
  never
