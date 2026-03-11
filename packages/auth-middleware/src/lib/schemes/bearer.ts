import type { RequestContext } from '@remix-run/fetch-router'
import type { AuthScheme } from '../types.ts'

const AUTH_HEADER_RE = /^([^\s]+)\s+(.+)$/

export interface BearerOptions<principal> {
  name?: string
  headerName?: string
  scheme?: string
  verify: (
    token: string,
    context: RequestContext,
  ) => principal | null | Promise<principal | null>
  challenge?: string
}

export function bearer<principal>(options: BearerOptions<principal>): AuthScheme<principal> {
  let name = options.name ?? 'bearer'
  let headerName = options.headerName ?? 'Authorization'
  let scheme = options.scheme ?? 'Bearer'
  let challenge = options.challenge ?? scheme

  return {
    name,
    async authenticate(context) {
      let value = context.headers.get(headerName)
      if (value == null) {
        return
      }

      let match = AUTH_HEADER_RE.exec(value)
      if (match == null) {
        return {
          status: 'failure',
          code: 'invalid_credentials',
          message: `${headerName} header is malformed`,
          challenge,
        }
      }

      let providedScheme = match[1]
      if (providedScheme.toLowerCase() !== scheme.toLowerCase()) {
        return null
      }

      let token = match[2].trim()
      if (token.length === 0) {
        return {
          status: 'failure',
          code: 'missing_credentials',
          message: `${scheme} token is missing`,
          challenge,
        }
      }

      let principal = await options.verify(token, context)

      if (principal == null) {
        return {
          status: 'failure',
          code: 'invalid_credentials',
          message: 'Invalid credentials',
          challenge,
        }
      }

      return {
        status: 'success',
        principal,
      }
    },
  }
}
