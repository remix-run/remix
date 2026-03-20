import type { RequestContext } from '@remix-run/fetch-router'

import type { AuthScheme } from '../auth.ts'

type ResolvedMethod<name, fallback extends string> = Extract<name, string> extends never
  ? fallback
  : Extract<name, string>

type InferIdentity<verify extends (key: string, context: RequestContext) => unknown> = Exclude<
  Awaited<ReturnType<verify>> ,
  null
>

/**
 * Options for creating an API-key auth scheme.
 */
export interface APIAuthSchemeOptions<identity, method extends string = 'api-key'> {
  /** Method name exposed on the resolved auth state. */
  name?: method
  /** Request header that carries the API key. */
  headerName?: string
  /** Verifies a parsed API key and returns the resolved identity on success. */
  verify(key: string, context: RequestContext): identity | null | Promise<identity | null>
}

/**
 * Creates an auth scheme that reads API keys from a request header.
 *
 * @param options Header parsing and key verification options.
 * @returns An auth scheme for use with `auth()`.
 */
export function createAPIAuthScheme<
  options extends {
    name?: string
    headerName?: string
    verify: (key: string, context: RequestContext) => unknown
  },
>(
  options: options,
): AuthScheme<InferIdentity<options['verify']>, ResolvedMethod<options['name'], 'api-key'>> {
  let name = (options.name ?? 'api-key') as ResolvedMethod<options['name'], 'api-key'>
  let headerName = options.headerName ?? 'X-API-Key'

  return {
    name,
    async authenticate(context) {
      let value = context.headers.get(headerName)
      if (value == null) {
        return
      }

      let key = value.trim()
      if (key.length === 0) {
        return {
          status: 'failure',
          code: 'missing_credentials',
          message: `${headerName} header is empty`,
        }
      }

      let identity = await options.verify(key, context)
      if (identity == null) {
        return {
          status: 'failure',
          code: 'invalid_credentials',
          message: 'Invalid credentials',
        }
      }

      return {
        status: 'success',
        identity: identity as InferIdentity<options['verify']>,
      }
    },
  }
}
