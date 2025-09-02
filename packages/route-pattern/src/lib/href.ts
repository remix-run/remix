import type { Params } from './params.ts'
import { parse } from './parse.ts'
import type { Part, PartNode } from './parse.types.ts'
import type { Variant } from './variant.ts'

export interface HrefBuilder<T extends string = string> {
  <V extends Variant<T>>(variant: V, ...args: HrefBuilderArgs<V>): string
}

// prettier-ignore
type HrefBuilderArgs<T extends string> =
  Params<T> extends infer P ?
    P extends Record<string, never> ? [] | [null, SearchParams] :
    [P] | [P, SearchParams] :
  never

type SearchParams = NonNullable<ConstructorParameters<typeof URLSearchParams>[0]>

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

export function createHrefBuilder<T extends string = string>(
  options: HrefBuilderOptions = {},
): HrefBuilder<T> {
  return <V extends Variant<T>>(variant: V, ...args: HrefBuilderArgs<V>) => {
    let params = (args[0] ?? {}) as Record<string, string>
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
        href += `:${ast.port}`
      }
    }

    if (ast.pathname) {
      let pathname = resolvePart(ast.pathname, params)
      href += pathname.startsWith('/') ? pathname : `/${pathname}`
    } else {
      href += '/'
    }

    if (searchParams || ast.searchParams) {
      href += `?${new URLSearchParams(searchParams ?? ast.searchParams).toString()}`
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
