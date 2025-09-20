import type { RequiredParams, OptionalParams } from './params.ts'
import { parse } from './parse.ts'
import type { Token, TokenList } from './parse.ts'
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

export interface HrefBuilder<T extends string | RoutePattern = string> {
  <P extends string extends T ? string : SourceOf<T> | Variant<SourceOf<T>>>(
    pattern: P | RoutePattern<P>,
    ...args: HrefBuilderArgs<P>
  ): string
}

type SourceOf<T> = T extends string ? T : T extends RoutePattern<infer S extends string> ? S : never

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

export interface HrefBuilderOptions {
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

export function createHrefBuilder<T extends string | RoutePattern = string>(
  options: HrefBuilderOptions = {},
): HrefBuilder<T> {
  return (pattern: string | RoutePattern, ...args: any) => {
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

function resolveTokens(tokens: TokenList, params: Record<string, any>): string {
  return tokens.map((token) => resolveToken(token, params)).join('')
}

function resolveToken(token: Token, params: Record<string, any>): string {
  switch (token.type) {
    case 'variable':
    case 'wildcard':
      let name = token.name ?? '*'

      if (params[name] == null) {
        throw new MissingParamError(name)
      }

      return String(params[name])

    case 'enum':
      return token.members[0] // Use first member

    case 'optional':
      try {
        return resolveTokens(token.tokens, params)
      } catch (error) {
        if (error instanceof MissingParamError) {
          return '' // Missing required parameter, ok to skip since it's optional
        }

        throw error
      }

    case 'text':
      return token.value
  }
}
