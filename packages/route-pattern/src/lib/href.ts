import type { RequiredParams, OptionalParams } from './params.ts'
import { parse } from './parse.ts'
import type { ParseResult } from './parse.ts'
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

export function createHrefBuilder<
  T extends string | RoutePattern | RouteMap = string,
>(): HrefBuilder<T> {
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

  // If the pattern has a hostname we can make a full URL.
  // Otherwise we can only make an absolute path.
  if (parsed.hostname) {
    // Default protocol is https because it's free these days so there's no
    // excuse not to use it.
    let protocol = parsed.protocol ? resolveTokens(parsed.protocol, '', params) : 'https'
    let host = resolveTokens(parsed.hostname, '.', params) + (parsed.port ? `:${parsed.port}` : '')
    href += `${protocol}://${host}`
  }

  if (parsed.pathname) {
    let pathname = resolveTokens(parsed.pathname, '/', params)
    href += pathname.startsWith('/') ? pathname : `/${pathname}`
  } else {
    href += '/'
  }

  if (searchParams) {
    href += `?${new URLSearchParams(searchParams)}`
  } else if (parsed.search) {
    href += `?${parsed.search}`
  }

  return href
}

function resolveTokens(tokens: Token[], sep: string, params: Record<string, any>): string {
  return tokens.map((token) => resolveToken(token, sep, params)).join('')
}

function resolveToken(token: Token, sep: string, params: Record<string, any>): string {
  if (token.type === 'variable' || token.type === 'wildcard') {
    let name = token.name ?? '*'
    if (params[name] == null) throw new MissingParamError(name)
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
  // text
  return token.value
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
export type HrefBuilderArgs<T extends string> =
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
