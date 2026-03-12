import type { RequestContext } from '@remix-run/fetch-router'
import type { AuthScheme } from '../types.ts'

const AUTH_HEADER_RE = /^([^\s]+)\s+(.+)$/

/**
 * Options for creating a bearer-token auth scheme.
 */
export interface BearerOptions<identity> {
  name?: string
  headerName?: string
  scheme?: string
  verify: (
    token: string,
    context: RequestContext,
  ) => identity | null | Promise<identity | null>
  challenge?: string
}

/**
 * Creates an auth scheme that reads bearer tokens from a request header.
 *
 * @param options Header parsing and token verification options.
 * @returns An auth scheme for use with `auth()`.
 */
export function bearer<identity>(options: BearerOptions<identity>): AuthScheme<identity> {
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

      let identity = await options.verify(token, context)

      if (identity == null) {
        return {
          status: 'failure',
          code: 'invalid_credentials',
          message: 'Invalid credentials',
          challenge,
        }
      }

      return {
        status: 'success',
        identity,
      }
    },
  }
}
