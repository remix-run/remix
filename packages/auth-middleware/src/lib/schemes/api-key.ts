import type { RequestContext } from '@remix-run/fetch-router'
import type { AuthScheme } from '../types.ts'

export interface ApiKeyOptions<identity> {
  name?: string
  headerName?: string
  verify: (key: string, context: RequestContext) => identity | null | Promise<identity | null>
}

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
