import type { RequiredParams, OptionalParams } from './params.ts'
import { parse, type ParseResult, type Token } from './parse.ts'
import type { RoutePattern } from './route-pattern.ts'
import type { Variant } from './variant.ts'

/**
 * An error thrown when a required parameter is missing when building an href.
 */
export class MissingParamError extends Error {
  /**
   * The name of the missing parameter.
   */
  readonly paramName: string

  /**
   * @param paramName The name of the missing parameter
   */
  constructor(paramName: string) {
    super(`Missing required parameter: ${paramName}`)
    this.name = 'MissingParamError'
    this.paramName = paramName
  }
}

/**
 * Create a reusable href builder function.
 *
 * @return A function that builds hrefs from patterns and parameters
 */
export function createHrefBuilder<T extends string | RoutePattern = string>(): HrefBuilder<T> {
  return (pattern: string | RoutePattern, ...args: any) =>
    formatHref(parse(typeof pattern === 'string' ? pattern : pattern.source), ...args)
}

export function formatHref(
  parsed: ParseResult,
  params?: Record<string, any>,
  searchParams?: Record<string, any>,
): string {
  params = params ?? {}

  let href = ''

  if (parsed.hostname != null) {
    // Default protocol is https because it's free these days so there's no
    // excuse not to use it.
    let protocol = parsed.protocol != null ? resolveTokens(parsed.protocol, '', params) : 'https'
    let hostname = resolveTokens(parsed.hostname, '.', params)
    let port = parsed.port != null ? `:${parsed.port}` : ''
    href += `${protocol}://${hostname}${port}`
  }

  if (parsed.pathname != null) {
    let pathname = resolveTokens(parsed.pathname, '/', params)
    href += pathname.startsWith('/') ? pathname : `/${pathname}`
  } else {
    href += '/'
  }

  if (searchParams) {
    let urlSearchParams: URLSearchParams
    if (
      typeof searchParams === 'object' &&
      !Array.isArray(searchParams) &&
      !(searchParams instanceof URLSearchParams)
    ) {
      let filteredParams: Record<string, string> = {}
      for (let key in searchParams) {
        let value = searchParams[key]
        if (value != null) {
          filteredParams[key] = String(value)
        }
      }
      urlSearchParams = new URLSearchParams(filteredParams)
    } else {
      urlSearchParams = new URLSearchParams(searchParams)
    }

    let search = urlSearchParams.toString()
    if (search !== '') {
      href += `?${search}`
    }
  } else if (parsed.search) {
    href += `?${parsed.search}`
  }

  return href
}

function resolveTokens(tokens: Token[], sep: string, params: Record<string, any>): string {
  let str = ''

  for (let token of tokens) {
    if (token.type === 'variable' || token.type === 'wildcard') {
      let name = token.name ?? '*'
      if (params[name] == null) throw new MissingParamError(name)
      str += String(params[name])
    } else if (token.type === 'text') {
      str += token.value
    } else if (token.type === 'separator') {
      str += sep
    } else if (token.type === 'optional') {
      try {
        str += resolveTokens(token.tokens, sep, params)
      } catch (error) {
        if (!(error instanceof MissingParamError)) {
          throw error
        }

        // Missing required parameter, ok to skip since it's optional
      }
    }
  }

  return str
}

/**
 * A function that builds hrefs from patterns and parameters.
 */
export interface HrefBuilder<T extends string | RoutePattern = string> {
  /**
   * @param pattern The pattern to build an href for
   * @param args The parameters and optional search params
   * @return The built href
   */
  <P extends string extends T ? string : SourceOf<T> | Variant<SourceOf<T>>>(
    pattern: P | RoutePattern<P>,
    ...args: HrefBuilderArgs<P>
  ): string
}

// prettier-ignore
type SourceOf<T> =
  T extends string ? T :
  T extends RoutePattern<infer S extends string> ? S :
  never

/**
 * The arguments for a `href()` function.
 */
// prettier-ignore
export type HrefBuilderArgs<T extends string> =
  [RequiredParams<T>] extends [never] ?
    [] | [null | undefined | Record<string, any>] | [null | undefined | Record<string, any>, HrefSearchParams] :
    [HrefParams<T>, HrefSearchParams] | [HrefParams<T>]

// prettier-ignore
type HrefParams<T extends string> =
  Record<RequiredParams<T>, ParamValue> &
  Partial<Record<OptionalParams<T>, ParamValue | null | undefined>>

type HrefSearchParams =
  | NonNullable<ConstructorParameters<typeof URLSearchParams>[0]>
  | Record<string, ParamValue | undefined | null>

type ParamValue = string | number | bigint | boolean
