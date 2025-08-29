import { parse } from './parse.ts'
import type { Ast, Parse, Part, PartNode } from './parse.types.ts'

export interface HrefBuilder<T extends string | undefined = undefined> {
  <V extends T extends string ? Variant<T> : string>(
    variant: V,
    ...args: HrefBuilderArgs<V>
  ): string
}

// prettier-ignore
type HrefBuilderArgs<T extends string> =
  Params<T> extends infer P extends string ?
    [P] extends [never] ? [] | [any, SearchParams] :
    [Record<P, string>] | [Record<P, string>, SearchParams] :
  never

interface HrefBuilderOptions {
  /**
   * The default protocol to use when the pattern doesn't specify one.
   * Defaults to `https`.
   */
  protocol?: string
  /**
   * The default host (including port) to use when the pattern doesn't specify one.
   * Defaults to an empty string.
   */
  host?: string
}

export function createHrefBuilder<Source extends string | undefined = undefined>(
  options: HrefBuilderOptions = {},
): HrefBuilder<Source> {
  return <V extends Source extends string ? Variant<Source> : string>(
    variant: V,
    ...args: HrefBuilderArgs<V>
  ) => {
    let params = args[0] ?? {}
    let searchParams = args[1]
    let ast = parse(variant)

    let href = ''

    // If we have a hostname to work with we can make a full URL. Otherwise we can only make an
    // absolute path.
    if (ast.hostname || options.host) {
      href += ast.protocol ? resolvePart(ast.protocol, params) : (options.protocol ?? 'https')
      href += '://'
      href += ast.hostname ? resolvePart(ast.hostname, params) : (options.host ?? '')
      if (ast.port) {
        href += ':'
        href += ast.port
      }
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

function resolvePart(part: Part, params: Record<string, string>): string {
  return part.map((node) => resolveNode(node, params)).join('')
}

function resolveNode(node: PartNode, params: Record<string, string>): string {
  if (node.type === 'variable') {
    if (!(node.name in params)) {
      throw new Error(`Missing required parameter: ${node.name}`)
    }

    return params[node.name]
  }
  if (node.type === 'wildcard') {
    let name = node.name ?? '*'

    if (!(name in params)) {
      throw new Error(`Missing required parameter: ${name}`)
    }

    return params[name]
  }
  if (node.type === 'enum') {
    throw new Error('Cannot use pattern with enum in href()')
  }
  if (node.type === 'optional') {
    throw new Error('Cannot use pattern with optional in href()')
  }

  // text
  return node.value
}

// Params and SearchParams -----------------------------------------------------------------------

// prettier-ignore
type Params<T extends string> =
  Parse<T> extends infer A extends Ast ?
    | (A['protocol'] extends Part ? PartParams<A['protocol']> : never)
    | (A['hostname'] extends Part ? PartParams<A['hostname']> : never)
    | (A['pathname'] extends Part ? PartParams<A['pathname']> : never) :
  never

// prettier-ignore
type PartParams<T extends Part> =
  T extends [infer L extends PartNode, ...infer R extends Array<PartNode>] ?
    L extends { type: 'variable', name: infer N extends string } ? N | PartParams<R> :
    L extends PartNode<'wildcard'> ? (L extends { name: infer N extends string } ? N : '*') | PartParams<R> :
    L extends PartNode<'optional'> ? PartParams<L['nodes']> | PartParams<R> :
    PartParams<R> :
  never

type SearchParams = NonNullable<ConstructorParameters<typeof URLSearchParams>[0]>

// Variant -----------------------------------------------------------------------------------------

// prettier-ignore
export type Variant<T extends string> = T extends any ? VariantString<Parse<T>> : never

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
    L extends PartNode<'optional'> ? PartVariantString<R> | `${PartVariantString<L['nodes']>}${PartVariantString<R>}` :
    never :
  ''
