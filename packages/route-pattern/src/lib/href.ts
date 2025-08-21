import { parse } from './parse.ts'
import type { Ast, Enum, Glob, Node, Optional, Variable, Parse, Part, Text } from './parse.types.ts'

// prettier-ignore
type HrefBuilderArgs<Source extends string> =
  Params<Source> extends infer params extends string ?
    [params] extends [never] ? [] :
    [Record<params, string>] :
  never;

export interface HrefBuilder<Source extends string> {
  <V extends Variant<Source>>(variant: V, ...args: HrefBuilderArgs<V>): string
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
    let ast = parse(variant)

    let href = ''
    href += ast.protocol ? resolvePart(ast.protocol, params) : (options.defaultProtocol ?? 'https')
    href += '://'
    href += ast.hostname ? resolvePart(ast.hostname, params) : (options.defaultHostname ?? '')
    href += '/'
    href += ast.pathname ? resolvePart(ast.pathname, params) : ''
    if (ast.search) {
      href += '?'
      href += ast.search.toString()
    }

    return href
  }
}

function resolvePart(part: Part, params: Record<string, string>) {
  return part
    .map((node) => {
      if (node.type === 'variable') {
        if (!node.name) throw new Error('Variants cannot include variables without names')
        return params[node.name]
      }
      if (node.type === 'glob') {
        if (!node.name) throw new Error('Variants cannot include globs without names')
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

type Variant<source extends string> = source extends any ? VariantSerialize<Parse<source>> : never

// prettier-ignore
type VariantSerialize<ast extends Ast> =
  ast extends { protocol: infer P extends Array<Node> } ?
    `${PartVariantSerialize<P>}${VariantSerialize<Omit<ast, 'protocol'>>}` :
  ast extends { hostname: infer H extends Array<Node> } ?
    `://${PartVariantSerialize<H>}/${VariantSerialize<Omit<ast, 'hostname'>>}` :
  ast extends { pathname: infer P extends Array<Node> } ?
    `${PartVariantSerialize<P>}${VariantSerialize<Omit<ast, 'pathname'>>}` :
  ast extends { search: infer S extends string } ?
    `?${S}` :
  ''

// prettier-ignore
type PartVariantSerialize<T extends Array<Node>> =
  T extends [infer L extends Node, ...infer R extends Array<Node>] ?
    L extends Variable ?
      L['name'] extends '' | undefined ? never :
      `:${L['name']}${PartVariantSerialize<R>}` :
    L extends Glob ? 
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
    L extends { type: 'variable' | 'glob', name: infer N } ? N | PartParams<R> :
    L extends Optional ? PartParams<L['nodes']> | PartParams<R> :
    PartParams<R> :
  never
