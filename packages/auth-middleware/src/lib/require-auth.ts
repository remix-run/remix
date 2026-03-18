import type { Middleware, RequestContext } from '@remix-run/fetch-router'
import { Auth, type BadAuth } from './auth.ts'

/**
 * Options for enforcing authentication on a route.
 */
export interface RequireAuthOptions {
  /** Custom response builder for unauthenticated requests. */
  onFailure?: (
    context: RequestContext,
    auth: BadAuth,
  ) => Response | Promise<Response>
}

/**
 * Enforces that `auth()` has already resolved a successful auth state for the current request.
 *
 * @param options Failure handling options for unauthenticated requests.
 * @returns Middleware that allows authenticated requests through and rejects anonymous ones.
 */
export function requireAuth(options: RequireAuthOptions = {}): Middleware {
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

    let response = await createFailureResponse(auth, context, options)

    if (auth.error?.challenge != null && response.headers.get('WWW-Authenticate') == null) {
      response = new Response(response.body, response)
      response.headers.append('WWW-Authenticate', auth.error.challenge)
    }

    return response
  }
}

async function createFailureResponse(
  auth: BadAuth,
  context: RequestContext,
  options: RequireAuthOptions,
): Promise<Response> {
  if (options.onFailure) {
    return options.onFailure(context, auth)
  }

  return new Response('Unauthorized', {
    status: 401,
  })
}
