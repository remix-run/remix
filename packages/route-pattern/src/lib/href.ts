import { parse } from './parse.ts'
import type { Ast, Enum, Glob, Node, Optional, Param, Parse, Part, Text } from './parse.types.ts'

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
      if (node.type === 'text') return node.value
      if (node.type === 'enum') throw new Error('Variant cannot include enums')
      if (node.type === 'optional') throw new Error('Variant cannot include optionals')

      if (!node.name) throw new Error('Variants cannot include params nor globs without names')
      if (node.type === 'param') return params[node.name]
      if (node.type === 'glob') return params[node.name]
    })
    .join('')
}

// Variant -----------------------------------------------------------------------------------------

type Variant<source extends string> = source extends any ? VariantSerialize<Parse<source>> : never

// prettier-ignore
type VariantSerialize<ast extends Ast> =
  ast extends { protocol: infer protocol extends Array<Node> } ?
    `${PartVariantSerialize<protocol>}${VariantSerialize<Omit<ast, 'protocol'>>}` :
  ast extends { hostname: infer hostname extends Array<Node> } ?
    `://${PartVariantSerialize<hostname>}/${VariantSerialize<Omit<ast, 'hostname'>>}` :
  ast extends { pathname: infer pathname extends Array<Node> } ?
    `${PartVariantSerialize<pathname>}${VariantSerialize<Omit<ast, 'pathname'>>}` :
  ast extends { search: infer search extends string } ?
    `?${search}` :
  ''

// prettier-ignore
type PartVariantSerialize<part extends Array<Node>> =
  part extends [infer node extends Node, ...infer nodes extends Array<Node>] ?
    node extends Param ?
      node['name'] extends '' | undefined ? never :
      `:${node['name']}${PartVariantSerialize<nodes>}` :
    node extends Glob ? 
      node['name'] extends '' | undefined ? never :
      `*${node['name']}${PartVariantSerialize<nodes>}` :
    node extends Enum ? `${node['members'][number]}${PartVariantSerialize<nodes>}` :
    node extends Text ? `${node['value']}${PartVariantSerialize<nodes>}` :
    node extends Optional ? PartVariantSerialize<nodes> | `${PartVariantSerialize<node['nodes']>}${PartVariantSerialize<nodes>}` :
    never :
  ''

// Params ------------------------------------------------------------------------------------------

// prettier-ignore
export type Params<source extends string> =
  Parse<source> extends infer ast extends Ast ?
    | (ast['protocol'] extends infer part extends Part ? PartParams<part> : never)
    | (ast['hostname'] extends infer part extends Part ? PartParams<part> : never)
    | (ast['pathname'] extends infer part extends Part ? PartParams<part> : never)
  :
  never;

// prettier-ignore
type PartParams<part extends Part> =
  part extends [infer L, ...infer R extends Array<Node>] ?
    L extends { type: 'param' | 'glob', name: infer name } ? name | PartParams<R> :
    L extends infer optional extends Optional ? PartParams<optional['nodes']> | PartParams<R> :
    PartParams<R> :
  never
