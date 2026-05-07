import type {
  GetContextValue,
  Middleware,
  RequestContext,
  ContextWithValue,
} from '@remix-run/fetch-router'

import { Auth, type BadAuth, type GoodAuth } from './auth.ts'

type ExistingGoodAuth<context extends RequestContext<any, any>> = Extract<
  GetContextValue<context, typeof Auth>,
  GoodAuth<any>
>

type IsDefaultGoodAuth<auth> = [auth] extends [GoodAuth<unknown>]
  ? [GoodAuth<unknown>] extends [auth]
    ? true
    : false
  : false

type ResolvedGoodAuth<context extends RequestContext<any, any>, identity> = [
  ExistingGoodAuth<context>,
] extends [never]
  ? GoodAuth<identity>
  : IsDefaultGoodAuth<ExistingGoodAuth<context>> extends true
    ? GoodAuth<identity>
    : ExistingGoodAuth<context>

type RequireAuthContextTransform<identity> = <context extends RequestContext<any, any>>(
  context: context,
) => ContextWithValue<context, typeof Auth, ResolvedGoodAuth<context, identity>>

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
 * @returns Middleware that allows authenticated requests through and rejects anonymous ones.
 */
export function requireAuth<identity = unknown>(
  options: RequireAuthOptions = {},
): Middleware<any, RequireAuthContextTransform<identity>> {
  return async (context, next) => {
    let auth = context.get(Auth)
    if (auth == null) {
      throw new Error(
        'Auth state not found. Make sure auth() middleware runs before requireAuth().',
      )
    }

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
