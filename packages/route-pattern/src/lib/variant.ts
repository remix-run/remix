import type { Ast, Parse, PartNode } from './parse.types.ts'
import type { IsEqual } from './type-utils'

// prettier-ignore
export type Variant<T extends string> = T extends any ?
  IsEqual<T, string> extends true ? string :
  VariantString<Parse<T>> :
  never

// prettier-ignore
type VariantString<T extends Ast> =
  T extends { protocol: infer P extends Array<PartNode> } ?
    `${PartVariantString<P>}${VariantString<Omit<T, 'protocol'>>}` :
  T extends { hostname: infer H extends Array<PartNode>, port: infer R extends string } ?
    `://${PartVariantString<H>}:${R}/${VariantString<Omit<T, 'hostname' | 'port'>>}` :
  T extends { hostname: infer H extends Array<PartNode> } ?
    `://${PartVariantString<H>}/${VariantString<Omit<T, 'hostname'>>}` :
  T extends { pathname: infer P extends Array<PartNode> } ?
    `${PartVariantString<P>}${VariantString<Omit<T, 'pathname'>>}` :
  T extends { search: infer S extends string } ?
    `?${S}` :
  ''

// prettier-ignore
type PartVariantString<T extends Array<PartNode>> =
  T extends [infer L extends PartNode, ...infer R extends Array<PartNode>] ?
    L extends PartNode<'variable'> ? `:${L['name']}${PartVariantString<R>}` :
    L extends PartNode<'wildcard'> ? (
      L extends { name: infer N extends string } ? `*${N}${PartVariantString<R>}` :
      `*${PartVariantString<R>}`
    ) :
    L extends PartNode<'enum'> ? (
      L extends { members: infer M extends readonly string[] } ? `${M[number]}${PartVariantString<R>}` :
      never
    ) :
    L extends PartNode<'text'> ? `${L['value']}${PartVariantString<R>}` :
    L extends PartNode<'optional'> ? `${PartVariantString<L['nodes']>}${PartVariantString<R>}` | PartVariantString<R> :
    never :
  ''
