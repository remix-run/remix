import type {
  ParseResult,
  Parse,
  Node,
  Variable,
  Wildcard,
  Enum,
  Text,
  Optional,
} from './parse.types.ts'
import type { IsEqual } from './type-utils.d.ts'

// prettier-ignore
export type Variant<T extends string> =
  T extends any ?
    IsEqual<T, string> extends true ? string :
    VariantString<Parse<T>> :
  never

// prettier-ignore
type VariantString<T extends ParseResult> =
  T extends { protocol: infer P extends Array<Node> } ?
    `${PartVariantString<P>}${VariantString<Omit<T, 'protocol'>>}` :
  T extends { hostname: infer H extends Array<Node>, port: infer R extends string } ?
    `://${PartVariantString<H>}:${R}/${VariantString<Omit<T, 'hostname' | 'port'>>}` :
  T extends { hostname: infer H extends Array<Node> } ?
    `://${PartVariantString<H>}/${VariantString<Omit<T, 'hostname'>>}` :
  T extends { pathname: infer P extends Array<Node> } ?
    `${PartVariantString<P>}${VariantString<Omit<T, 'pathname'>>}` :
  T extends { search: infer S extends string } ?
    `?${S}` :
  ''

// prettier-ignore
type PartVariantString<T extends Array<Node>> =
  T extends [infer L extends Node, ...infer R extends Array<Node>] ?
    L extends Variable ? `:${L['name']}${PartVariantString<R>}` :
    L extends Wildcard ? (
      L extends { name: infer N extends string } ? `*${N}${PartVariantString<R>}` :
      `*${PartVariantString<R>}`
    ) :
    L extends Enum ? (
      L extends { members: infer M extends readonly string[] } ? `${M[number]}${PartVariantString<R>}` :
      never
    ) :
    L extends Text ? `${L['value']}${PartVariantString<R>}` :
    L extends Optional ? `${PartVariantString<L['nodes']>}${PartVariantString<R>}` | PartVariantString<R> :
    never :
  ''
