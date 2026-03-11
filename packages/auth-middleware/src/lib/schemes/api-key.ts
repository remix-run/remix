import type { RequestContext } from '@remix-run/fetch-router'
import type { AuthScheme } from '../types.ts'

export interface ApiKeyOptions<principal> {
  name?: string
  headerName?: string
  verify: (key: string, context: RequestContext) => principal | null | Promise<principal | null>
}

export function apiKey<principal>(options: ApiKeyOptions<principal>): AuthScheme<principal> {
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

      let principal = await options.verify(key, context)
      if (principal == null) {
        return {
          status: 'failure',
          code: 'invalid_credentials',
          message: 'Invalid credentials',
        }
      }

      return {
        status: 'success',
        principal,
      }
    },
  }
}
