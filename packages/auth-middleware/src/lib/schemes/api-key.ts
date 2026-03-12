import type { RequestContext } from '@remix-run/fetch-router'
import type { AuthScheme } from '../types.ts'

/**
 * Options for creating an API-key auth scheme.
 */
export interface ApiKeyOptions<identity> {
  name?: string
  headerName?: string
  verify: (key: string, context: RequestContext) => identity | null | Promise<identity | null>
}

/**
 * Creates an auth scheme that reads API keys from a request header.
 *
 * @param options Header parsing and key verification options.
 * @returns An auth scheme for use with `auth()`.
 */
export function apiKey<identity>(options: ApiKeyOptions<identity>): AuthScheme<identity> {
  let name = options.name ?? 'api-key'
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
        identity,
      }
    },
  }
}
