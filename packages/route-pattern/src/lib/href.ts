import { parse } from './parse.ts'
import type {
  Ast,
  Enum,
  Wildcard,
  Node,
  Optional,
  Variable,
  Parse,
  Part,
  Text,
} from './parse.types.ts'

// prettier-ignore
type HrefBuilderArgs<T extends string> =
  Params<T> extends infer params extends string ?
    [params] extends [never] ? [] | [any, SearchParams] :
    [Record<params, string>] | [Record<params, string>, SearchParams] :
  never;

export interface HrefBuilder<T extends string> {
  <V extends Variant<T>>(variant: V, ...args: HrefBuilderArgs<V>): string
}

interface HrefBuilderOptions {
  /**
   * The default protocol to use when the pattern doesn't specify one.
   * Defaults to `https`.
   */
  defaultProtocol?: string
  /**
   * The default hostname to use when the pattern doesn't specify one.
   * Defaults to an empty string.
   */
  defaultHostname?: string
}

export function createHrefBuilder<Source extends string>(
  options: HrefBuilderOptions = {},
): HrefBuilder<Source> {
  return <V extends Variant<Source>>(variant: V, ...args: HrefBuilderArgs<V>) => {
    let params = args[0] ?? {}
    let searchParams = args[1]
    let ast = parse(variant)

    let href = ''

    // If we have a hostname to work with we can make a full URL. Otherwise we can only make an
    // absolute path.
    if (ast.hostname || options.defaultHostname) {
      href += ast.protocol
        ? resolvePart(ast.protocol, params)
        : (options.defaultProtocol ?? 'https')
      href += '://'
      href += ast.hostname ? resolvePart(ast.hostname, params) : (options.defaultHostname ?? '')
    }

    href += '/'
    href += ast.pathname ? resolvePart(ast.pathname, params) : ''

    if (searchParams || ast.search) {
      href += '?'
      href += new URLSearchParams(searchParams ?? ast.search).toString()
    }

    return href
  }
}

function resolvePart(part: Part, params: Record<string, string>) {
  return part
    .map((node) => {
      if (node.type === 'variable') {
        return params[node.name]
      }
      if (node.type === 'wildcard') {
        return params[node.name]
      }
      if (node.type === 'text') return node.value
      if (node.type === 'enum') throw new Error('Variants cannot include enums')
      if (node.type === 'optional') throw new Error('Variants cannot include optionals')

      node satisfies never
    })
    .join('')
}

// Variant -----------------------------------------------------------------------------------------

type Variant<T extends string> = T extends any ? VariantSerialize<Parse<T>> : never

// prettier-ignore
type VariantSerialize<T extends Ast> =
  T extends { protocol: infer P extends Array<Node> } ?
    `${PartVariantSerialize<P>}${VariantSerialize<Omit<T, 'protocol'>>}` :
  T extends { hostname: infer H extends Array<Node> } ?
    `://${PartVariantSerialize<H>}/${VariantSerialize<Omit<T, 'hostname'>>}` :
  T extends { pathname: infer P extends Array<Node> } ?
    `${PartVariantSerialize<P>}${VariantSerialize<Omit<T, 'pathname'>>}` :
  T extends { search: infer S extends string } ?
    `?${S}` :
  ''

// prettier-ignore
type PartVariantSerialize<T extends Array<Node>> =
  T extends [infer L extends Node, ...infer R extends Array<Node>] ?
    L extends Variable ?
      L['name'] extends '' | undefined ? never :
      `:${L['name']}${PartVariantSerialize<R>}` :
    L extends Wildcard ? 
      L['name'] extends '' | undefined ? never :
      `*${L['name']}${PartVariantSerialize<R>}` :
    L extends Enum ? `${L['members'][number]}${PartVariantSerialize<R>}` :
    L extends Text ? `${L['value']}${PartVariantSerialize<R>}` :
    L extends Optional ? PartVariantSerialize<R> | `${PartVariantSerialize<L['nodes']>}${PartVariantSerialize<R>}` :
    never :
  ''

// Params ------------------------------------------------------------------------------------------

// prettier-ignore
export type Params<T extends string> =
  Parse<T> extends infer ast extends Ast ?
    | (ast['protocol'] extends Part ? PartParams<ast['protocol']> : never)
    | (ast['hostname'] extends Part ? PartParams<ast['hostname']> : never)
    | (ast['pathname'] extends Part ? PartParams<ast['pathname']> : never)
  :
  never;

// prettier-ignore
type PartParams<T extends Part> =
  T extends [infer L extends Node, ...infer R extends Array<Node>] ?
    L extends { type: 'variable' | 'wildcard', name: infer N } ? N | PartParams<R> :
    L extends Optional ? PartParams<L['nodes']> | PartParams<R> :
    PartParams<R> :
  never

// SearchParams -----------------------------------------------------------------------------------

export type SearchParams = NonNullable<ConstructorParameters<typeof URLSearchParams>[0]>
