import type {
  ParseResult,
  Parse,
  Token,
  Variable,
  Wildcard,
  Enum,
  Text,
  Optional,
} from './parse.ts'
import type { IsEqual } from '../type-utils.d.ts'

// prettier-ignore
export type Variant<T extends string> =
  T extends any ?
    IsEqual<T, string> extends true ? string :
    VariantString<Parse<T>, HasLeadingSlash<T>> :
  never

// Detect if the original pattern begins with a leading slash (and is not an origin URL)
// prettier-ignore
type HasLeadingSlash<T extends string> =
  T extends `${string}://${string}` ? false :
  T extends `/${string}` ? true :
  false

// prettier-ignore
type VariantString<T extends ParseResult, L extends boolean> =
  T extends { protocol: infer P extends Array<Token> } ?
    `${PartVariantString<P>}${VariantString<Omit<T, 'protocol'>, false>}` :
  T extends { hostname: infer H extends Array<Token>, port: infer R extends string } ?
    `://${PartVariantString<H>}:${R}/${VariantString<Omit<T, 'hostname' | 'port'>, false>}` :
  T extends { hostname: infer H extends Array<Token> } ?
    `://${PartVariantString<H>}/${VariantString<Omit<T, 'hostname'>, false>}` :
  T extends { pathname: infer P extends Array<Token> } ?
    `${L extends true ? '/' : ''}${PartVariantString<P>}${VariantString<Omit<T, 'pathname'>, false>}` :
  T extends { search: infer S extends string } ?
    `?${S}` :
  ''

// prettier-ignore
type PartVariantString<T extends Array<Token>> =
  T extends [infer L extends Token, ...infer R extends Array<Token>] ?
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
    L extends Optional ? `${PartVariantString<L['tokens']>}${PartVariantString<R>}` | PartVariantString<R> :
    never :
  ''
