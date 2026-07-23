import type { Middleware, RequestContext } from '@remix-run/fetch-router'

import { Auth, type BadAuth, type GoodAuth } from './auth.ts'

/**
 * Options for enforcing authentication on a route.
 */
export interface RequireAuthOptions {
  /** Custom response builder for unauthenticated requests. */
  onFailure?: (context: RequestContext, auth: BadAuth) => Response | Promise<Response>
}

/**
 * Enforces that `auth()` has already resolved a successful auth state for the current request.
 *
 * @param options Failure handling options for unauthenticated requests.
 * @returns Middleware that allows authenticated requests through, rejects anonymous ones, and
 * narrows auth state on request context.
 */
export function requireAuth<identity = unknown>(
  options: RequireAuthOptions = {},
): Middleware<{ key: typeof Auth; value: GoodAuth<identity>; property: 'auth' }, Response> {
  return async (context, next) => {
    let auth = context.get(Auth)
    if (auth == null) {
      throw new Error(
        'Auth state not found. Make sure auth() middleware runs before requireAuth().',
      )
    }

    if (auth.ok) {
      context.set(Auth, auth, { property: 'auth' })
      let response = await next()
      assertResponse(response)
      return response
    }

    let response = await createFailureResponse(auth, context, options)

    if (auth.error?.challenge != null && response.headers.get('WWW-Authenticate') == null) {
      response = new Response(response.body, response)
      response.headers.append('WWW-Authenticate', auth.error.challenge)
    }

    return response
  }
}

function assertResponse(value: unknown): asserts value is Response {
  if (!(value instanceof Response)) {
    throw new TypeError('requireAuth() expected next() to return a Response')
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
