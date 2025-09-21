import type {
  ParseResult,
  Parse,
  Token,
  Variable,
  Wildcard,
  Enum,
  Text,
  Separator,
  Optional,
} from './parse.ts'

// prettier-ignore
export type Variant<T extends string> =
  T extends any ?
    string extends T ? string : VariantString<Parse<T>, HasLeadingSlash<T>> :
  never

// Detect if the original pattern begins with a leading slash (and is not an origin URL)
// prettier-ignore
type HasLeadingSlash<T extends string> =
  T extends `${string}://${string}` ? false :
  T extends `/${string}` ? true :
  false

// prettier-ignore
type VariantString<T extends Partial<ParseResult>, L extends boolean> =
  T extends { protocol: infer P extends Array<Token> } ?
    `${PartVariantString<P>}${VariantString<Omit<T, 'protocol'>, false>}` :
  T extends { hostname: infer H extends Array<Token>, port: infer P extends string } ?
    `://${PartVariantString<H, '.'>}:${P}${VariantString<Omit<T, 'hostname' | 'port'>, false> extends '' ? '' : `/${VariantString<Omit<T, 'hostname' | 'port'>, false>}`}` :
  T extends { hostname: infer H extends Array<Token> } ?
    `://${PartVariantString<H, '.'>}${VariantString<Omit<T, 'hostname'>, false> extends '' ? '' : `/${VariantString<Omit<T, 'hostname'>, false>}`}` :
  T extends { pathname: infer P extends Array<Token> } ?
    `${L extends true ? '/' : ''}${PartVariantString<P, '/'>}${VariantString<Omit<T, 'pathname'>, false>}` :
  T extends { search: infer S extends string } ?
    `?${S}` :
  ''

// prettier-ignore
type PartVariantString<T extends Array<Token>, Sep extends string = '/'> =
  T extends [infer L extends Token, ...infer R extends Array<Token>] ?
    L extends Variable ? `:${L['name']}${PartVariantString<R, Sep>}` :
    L extends Wildcard ? (
      L extends { name: infer N extends string } ? `*${N}${PartVariantString<R, Sep>}` :
      `*${PartVariantString<R, Sep>}`
    ) :
    L extends Enum ? (
      L extends { members: infer M extends readonly string[] } ? `${M[number]}${PartVariantString<R, Sep>}` :
      never
    ) :
    L extends Text ? `${L['value']}${PartVariantString<R, Sep>}` :
    L extends Separator ? `${Sep}${PartVariantString<R, Sep>}` :
    L extends Optional ? `${PartVariantString<L['tokens'], Sep>}${PartVariantString<R, Sep>}` | PartVariantString<R, Sep> :
    never :
  ''
