import {
  createContextKey,
  type Middleware,
  type RequestContext,
} from '@remix-run/fetch-router'

/**
 * Failure details for an unauthenticated request.
 */
export interface AuthFailure {
  method?: string
  code: 'missing_credentials' | 'invalid_credentials'
  message: string
  challenge?: string
}

/**
 * Auth state for a successfully authenticated request.
 */
export interface AuthenticatedAuth<identity = unknown, method extends string = string> {
  ok: true
  identity: identity
  method: method
}

/**
 * Auth state for a request that did not authenticate successfully.
 */
export interface UnauthenticatedAuth {
  ok: false
  error?: AuthFailure
}

/**
 * Request auth state stored in the router context.
 */
export type Auth<identity = unknown, method extends string = string> =
  | AuthenticatedAuth<identity, method>
  | UnauthenticatedAuth

/**
 * Context key used to read auth state with `context.get(Auth)`.
 */
export const Auth = createContextKey<Auth>()

/**
 * Successful result returned by an auth scheme.
 */
export interface AuthSchemeSuccess<identity = unknown> {
  status: 'success'
  identity: identity
}

/**
 * Failure result returned by an auth scheme.
 */
export interface AuthSchemeFailure {
  status: 'failure'
  code?: AuthFailure['code']
  message?: string
  challenge?: string
}

/**
 * Non-skipped results an auth scheme can return.
 */
export type AuthSchemeResult<identity = unknown> =
  | AuthSchemeSuccess<identity>
  | AuthSchemeFailure

/**
 * Full return type for an auth scheme, including skipped requests.
 */
export type AuthSchemeAuthenticateResult<identity = unknown> =
  | AuthSchemeResult<identity>
  | null
  | undefined
  | void

/**
 * Authentication scheme contract consumed by `auth()`.
 */
export interface AuthScheme<identity = unknown, method extends string = string> {
  name: method
  authenticate(
    context: RequestContext,
  ): AuthSchemeAuthenticateResult<identity> | Promise<AuthSchemeAuthenticateResult<identity>>
}

/**
 * Options for loading auth state for each request.
 */
export interface AuthOptions {
  schemes: AuthScheme[]
}

/**
 * Loads auth state for the current request by running each configured auth scheme in order.
 *
 * @param options Auth scheme configuration for the middleware.
 * @returns Middleware that resolves auth state into `context.get(Auth)`.
 */
export function auth(options: AuthOptions): Middleware {
  if (options.schemes.length === 0) {
    throw new Error('auth() requires at least one authentication scheme')
  }

  return async (context, next) => {
    for (let scheme of options.schemes) {
      let result = await scheme.authenticate(context)

      if (result == null) {
        continue
      }

      if (result.status === 'success') {
        context.set(Auth, {
          ok: true,
          identity: result.identity,
          method: scheme.name,
        } satisfies Auth)

        return next()
      }

      if (result.status !== 'failure') {
        throw new Error(
          `Invalid result from "${scheme.name}" auth scheme. Return null/undefined to skip, or a { status: 'success' | 'failure' } object.`,
        )
      }

      context.set(Auth, {
        ok: false,
        error: createFailure(scheme, result),
      } satisfies Auth)

      return next()
    }

    context.set(Auth, {
      ok: false,
    } satisfies Auth)

    return next()
  }
}

function createFailure(
  scheme: AuthScheme,
  result: AuthSchemeFailure,
): AuthFailure {
  return {
    method: scheme.name,
    code: result.code ?? 'invalid_credentials',
    message: result.message ?? 'Invalid credentials',
    challenge: result.challenge,
  }
}
