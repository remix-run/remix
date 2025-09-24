import type { RequiredParams, OptionalParams } from './params.ts'
import { parse } from './parse.ts'
import type { Token } from './parse.ts'
import type { RouteMap } from './route-map.ts'
import type { RoutePattern } from './route-pattern.ts'
import type { Variant } from './variant.ts'

export class MissingParamError extends Error {
  readonly paramName: string

  constructor(paramName: string) {
    super(`Missing required parameter: ${paramName}`)
    this.name = 'MissingParamError'
    this.paramName = paramName
  }
}

export interface HrefBuilder<T extends string | RoutePattern | RouteMap = string> {
  <P extends string extends T ? string : SourceOf<T> | Variant<SourceOf<T>>>(
    pattern: P | RoutePattern<P>,
    ...args: HrefBuilderArgs<P>
  ): string
}

// prettier-ignore
type SourceOf<T> =
  T extends string ? T :
  T extends RoutePattern<infer S extends string> ? S :
  T extends RouteMap<infer S extends string> ? S :
  never

// prettier-ignore
type HrefBuilderArgs<T extends string> =
  [RequiredParams<T>] extends [never] ?
    [] | [null | undefined | Record<string, any>] | [null | undefined | Record<string, any>, HrefSearchParams] :
    [HrefParams<T>] | [HrefParams<T>, HrefSearchParams]

// prettier-ignore
type HrefParams<T extends string> =
  Record<RequiredParams<T>, ParamValue> &
  Partial<Record<OptionalParams<T>, ParamValue | null | undefined>>

type HrefSearchParams =
  | NonNullable<ConstructorParameters<typeof URLSearchParams>[0]>
  | Record<string, ParamValue>

type ParamValue = string | number | bigint | boolean

export type HrefBuilderOptions = ProtocolHostOptions | OriginOptions

export interface ProtocolHostOptions {
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
  // Exclude OriginOptions
  origin?: never
}

export interface OriginOptions {
  /**
   * The default origin to use when the pattern doesn't specify one.
   * Defaults to an empty string.
   */
  origin?: string
  // Exclude ProtocolHostOptions
  protocol?: never
  host?: never
}

export function createHrefBuilder<T extends string | RoutePattern | RouteMap = string>(
  options: HrefBuilderOptions = {},
): HrefBuilder<T> {
  return (pattern: string | RoutePattern, ...args: any) => {
    let params = args[0] ?? {}
    let searchParams = args[1]
    let parsed = parse(typeof pattern === 'string' ? pattern : pattern.source)

    let href = ''

    // If we have a default origin or the pattern has a hostname we can make a full URL.
    // Otherwise we can only make an absolute path.
    if (options.origin) {
      href += options.origin
    } else if (parsed.hostname || options.host) {
      let protocol = parsed.protocol
        ? resolveTokens(parsed.protocol, '', params)
        : (options.protocol?.replace(/:$/, '') ?? 'https')

      let host = parsed.hostname
        ? resolveTokens(parsed.hostname, '.', params) + (parsed.port ? `:${parsed.port}` : '')
        : options.host

      href += `${protocol}://${host}`
    }

    if (parsed.pathname) {
      let pathname = resolveTokens(parsed.pathname, '/', params)
      href += pathname.startsWith('/') ? pathname : `/${pathname}`
    } else {
      href += '/'
    }

    if (searchParams || parsed.search) {
      href += `?${new URLSearchParams(searchParams ?? parsed.search)}`
    }

    return href
  }
}

function resolveTokens(tokens: Token[], sep: string, params: Record<string, any>): string {
  let result = ''

  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i]
    let nextToken = i === tokens.length - 2 ? tokens[i + 1] : undefined

    // Check for the special case: separator followed by a wildcard as the last token
    if (token.type === 'separator' && nextToken?.type === 'wildcard') {
      // Handle the trailing separator + wildcard as optional
      let wildcardName = nextToken.name ?? '*'
      if (params[wildcardName] != null && params[wildcardName] !== '') {
        result += sep + String(params[wildcardName])
      }

      // Skip the next token since we handled it here
      i++
      continue
    }

    result += resolveToken(token, sep, params)
  }

  return result
}

function resolveToken(token: Token, sep: string, params: Record<string, any>): string {
  if (token.type === 'variable' || token.type === 'wildcard') {
    let name = token.name ?? '*'

    if (params[name] == null) {
      throw new MissingParamError(name)
    }

    return String(params[name])
  }

  if (token.type === 'separator') {
    return sep
  }

  if (token.type === 'optional') {
    try {
      return resolveTokens(token.tokens, sep, params)
    } catch (error) {
      if (error instanceof MissingParamError) {
        return '' // Missing required parameter, ok to skip since it's optional
      }
      throw error
    }
  }

  return token.value
}
