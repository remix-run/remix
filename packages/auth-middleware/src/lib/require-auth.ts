import type { Middleware, RequestContext } from '@remix-run/fetch-router'
import { Auth, type UnauthenticatedAuth } from './auth.ts'

/**
 * Options for enforcing authentication on a route.
 */
export interface RequireAuthOptions {
  onFailure?: (
    context: RequestContext,
    auth: UnauthenticatedAuth,
  ) => Response | Promise<Response>
  status?: number
  body?: BodyInit | null
  headers?: HeadersInit
}

/**
 * Enforces that `auth()` has already resolved a successful auth state for the current request.
 *
 * @param options Failure handling and default response options for unauthenticated requests.
 * @returns Middleware that allows authenticated requests through and rejects anonymous ones.
 */
export function requireAuth(options: RequireAuthOptions = {}): Middleware {
  let status = options.status ?? 401
  let body = options.body ?? 'Unauthorized'

  return async (context, next) => {
    if (!context.has(Auth)) {
      throw new Error(
        'Auth state not found. Make sure auth() middleware runs before requireAuth().',
      )
    }

    let auth = context.get(Auth)

    if (auth.ok) {
      return next()
    }

    let response = await createFailureResponse(auth, context, options, status, body)

    if (auth.error?.challenge != null && response.headers.get('WWW-Authenticate') == null) {
      response = new Response(response.body, response)
      response.headers.append('WWW-Authenticate', auth.error.challenge)
    }

    return response
  }
}

async function createFailureResponse(
  auth: UnauthenticatedAuth,
  context: RequestContext,
  options: RequireAuthOptions,
  status: number,
  body: BodyInit | null,
): Promise<Response> {
  if (options.onFailure) {
    return options.onFailure(context, auth)
  }

  return new Response(body, {
    status,
    headers: options.headers,
  })
}
