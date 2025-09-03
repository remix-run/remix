import type { RequiredParams, OptionalParams } from './params.ts'
import { parse } from './parse.ts'
import type { Part, PartNode } from './parse.types.ts'
import type { Variant } from './variant.ts'

export class MissingParamError extends Error {
  paramName: string

  constructor(paramName: string) {
    super(`Missing required parameter: ${paramName}`)
    this.name = 'MissingParamError'
    this.paramName = paramName
  }
}

type ParamValue = string | number | bigint | boolean
type AnyParams = Record<string, ParamValue>

export interface HrefBuilder<T extends string | undefined = undefined> {
  <P extends T extends string ? T | Variant<T> : string>(
    pattern: P,
    ...args: HrefBuilderArgs<P>
  ): string
}

// prettier-ignore
type HrefBuilderArgs<T extends string> =
  [RequiredParams<T>] extends [never] ?
    [] | [null | undefined | AnyParams] | [null | undefined | AnyParams, HrefSearchParams] :
    [HrefParams<T>] | [HrefParams<T>, HrefSearchParams]

// prettier-ignore
type HrefParams<T extends string> =
  Record<RequiredParams<T>, ParamValue> & Partial<Record<OptionalParams<T>, ParamValue>>

type HrefSearchParams = NonNullable<ConstructorParameters<typeof URLSearchParams>[0]>

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
  return (pattern: string, ...args: any) => {
    let params = args[0] ?? {}
    let searchParams = args[1]
    let ast = parse(pattern)

    let href = ''

    // If we have a hostname to work with we can make a full URL. Otherwise we can only make an
    // absolute path.
    if (ast.hostname || options.host) {
      if (ast.protocol) {
        href += resolvePart(ast.protocol, params)
      } else if (options.protocol) {
        href += options.protocol.replace(/:$/, '')
      } else {
        href += 'https'
      }

      href += '://'

      if (ast.hostname) {
        href += resolvePart(ast.hostname, params)
        if (ast.port) {
          href += `:${ast.port}`
        }
      } else {
        href += options.host
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

function resolvePart(part: Part, params: AnyParams): string {
  return part.map((node) => resolveNode(node, params)).join('')
}

function resolveNode(node: PartNode, params: AnyParams): string {
  if (node.type === 'variable') {
    if (params[node.name] == null) {
      throw new MissingParamError(node.name)
    }

    return String(params[node.name])
  }
  if (node.type === 'wildcard') {
    let name = node.name ?? '*'

    if (params[name] == null) {
      throw new MissingParamError(name)
    }

    return String(params[name])
  }
  if (node.type === 'enum') {
    return node.members[0] // Use first member
  }
  if (node.type === 'optional') {
    try {
      return node.nodes.map((node) => resolveNode(node, params)).join('')
    } catch (error) {
      if (error instanceof MissingParamError) {
        return '' // Missing required parameter, ok to skip since it's optional
      }

      throw error
    }
  }

  // text
  return node.value
}
