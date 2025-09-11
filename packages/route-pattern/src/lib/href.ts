import type { RequiredParams, OptionalParams } from './params.ts'
import { parse } from './parse.ts'
import type { Token, TokenList } from './parse.types.ts'
import type { Variant } from './variant.ts'
import type { RoutePattern } from './route-pattern.ts'

export class MissingParamError extends Error {
  readonly paramName: string

  constructor(paramName: string) {
    super(`Missing required parameter: ${paramName}`)
    this.name = 'MissingParamError'
    this.paramName = paramName
  }
}

type ParamValue = string | number | bigint | boolean
type AnyParams = Record<string, ParamValue>

export interface HrefBuilder<T extends string | RoutePattern<any> | undefined = undefined> {
  // Accept a RoutePattern instance
  <P extends T extends undefined ? string : SourceOf<T> | Variant<SourceOf<T>>>(
    pattern: RoutePattern<P>,
    ...args: HrefBuilderArgs<P>
  ): string
  // And accept a string pattern
  // Also, make this the last signature so Parameters<HrefBuilder<...>> picks it
  <P extends T extends undefined ? string : SourceOf<T> | Variant<SourceOf<T>>>(
    pattern: P,
    ...args: HrefBuilderArgs<P>
  ): string
}

type SourceOf<T> = T extends string ? T : T extends RoutePattern<infer S extends string> ? S : never

// prettier-ignore
type HrefBuilderArgs<T extends string> =
  [RequiredParams<T>] extends [never] ?
    [] | [null | undefined | AnyParams] | [null | undefined | AnyParams, HrefSearchParams] :
    [HrefParams<T>] | [HrefParams<T>, HrefSearchParams]

// prettier-ignore
type HrefParams<T extends string> =
  Record<RequiredParams<T>, ParamValue> & Partial<Record<OptionalParams<T>, ParamValue>>

type HrefSearchParams = NonNullable<ConstructorParameters<typeof URLSearchParams>[0]> | AnyParams

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

export function createHrefBuilder<T extends string | RoutePattern<any> = string>(
  options: HrefBuilderOptions = {},
): HrefBuilder<T> {
  return (pattern: string | RoutePattern<any>, ...args: any) => {
    let params = args[0] ?? {}
    let searchParams = args[1]
    let parsed = parse(typeof pattern === 'string' ? pattern : pattern.source)

    let href = ''

    // If we have a hostname to work with we can make a full URL. Otherwise we can only make an
    // absolute path.
    if (parsed.hostname || options.host) {
      if (parsed.protocol) {
        href += resolveTokens(parsed.protocol, params)
      } else if (options.protocol) {
        href += options.protocol.replace(/:$/, '')
      } else {
        href += 'https'
      }

      href += '://'

      if (parsed.hostname) {
        href += resolveTokens(parsed.hostname, params)
        if (parsed.port) {
          href += `:${parsed.port}`
        }
      } else {
        href += options.host
      }
    }

    if (parsed.pathname) {
      let pathname = resolveTokens(parsed.pathname, params)
      href += pathname.startsWith('/') ? pathname : `/${pathname}`
    } else {
      href += '/'
    }

    if (searchParams || parsed.search) {
      href += `?${new URLSearchParams(searchParams ?? parsed.search).toString()}`
    }

    return href
  }
}

function resolveTokens(tokens: TokenList, params: AnyParams): string {
  return tokens.map((token) => resolveToken(token, params)).join('')
}

function resolveToken(token: Token, params: AnyParams): string {
  if (token.type === 'variable') {
    if (params[token.name] == null) {
      throw new MissingParamError(token.name)
    }

    return String(params[token.name])
  }
  if (token.type === 'wildcard') {
    let name = token.name ?? '*'

    if (params[name] == null) {
      throw new MissingParamError(name)
    }

    return String(params[name])
  }
  if (token.type === 'enum') {
    return token.members[0] // Use first member
  }
  if (token.type === 'optional') {
    try {
      return resolveTokens(token.tokens, params)
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
