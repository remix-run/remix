import {
  createContextKey,
  type ContextEntry,
  type ContextWithValues,
  type Middleware,
  type RequestContext,
} from '@remix-run/fetch-router'

/**
 * Failure details for an unauthenticated request.
 */
export interface AuthFailure {
  /** Auth method that reported the failure. */
  method?: string
  /** Failure category used by built-in auth middleware and schemes. */
  code: 'missing_credentials' | 'invalid_credentials'
  /** Human-readable explanation of the auth failure. */
  message: string
  /** Optional challenge value for `WWW-Authenticate`. */
  challenge?: string
}

/**
 * Auth state for a successfully authenticated request.
 */
export interface GoodAuth<identity = unknown> {
  /** Indicates that the current request is authenticated. */
  ok: true
  /** Application-defined identity resolved for the current request. */
  identity: identity
  /** Auth method that successfully authenticated the request. */
  method: string
}

/**
 * Auth state for a request that did not authenticate successfully.
 */
export interface BadAuth {
  /** Indicates that the current request is not authenticated. */
  ok: false
  /** Failure details when authentication was attempted and rejected. */
  error?: AuthFailure
}

/**
 * Request auth state stored in the router context.
 */
export type AuthState<identity = unknown> = GoodAuth<identity> | BadAuth

/**
 * Context key used to read auth state with `context.get(Auth)`.
 */
export const Auth = createContextKey<AuthState>()

type AuthContextEntry<auth> = ContextEntry<typeof Auth, auth>

export type ContextWithAuth<
  context extends RequestContext<any, any>,
  identity = unknown,
> = ContextWithValues<context, [AuthContextEntry<AuthState<identity>>]>

export type ContextWithRequiredAuth<
  context extends RequestContext<any, any>,
  identity = unknown,
> = ContextWithValues<context, [AuthContextEntry<GoodAuth<identity>>]>

/**
 * Successful result returned by an auth scheme.
 */
export interface AuthSchemeSuccess<identity = unknown> {
  /** Marks the scheme result as a successful authentication. */
  status: 'success'
  /** Application-defined identity resolved by the scheme. */
  identity: identity
}

/**
 * Failure result returned by an auth scheme.
 */
export interface AuthSchemeFailure {
  /** Marks the scheme result as an authentication failure. */
  status: 'failure'
  /** Failure category reported by the scheme. */
  code?: AuthFailure['code']
  /** Human-readable explanation of the failure. */
  message?: string
  /** Optional challenge value for `WWW-Authenticate`. */
  challenge?: string
}

/**
 * Non-skipped results an auth scheme can return.
 */
export type AuthSchemeResult<identity = unknown> = AuthSchemeSuccess<identity> | AuthSchemeFailure

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
export interface AuthScheme<identity = unknown> {
  /** Stable method name exposed on the resolved auth state. */
  name: string
  /** Authenticates the current request or returns `null`/`undefined` to skip the scheme. */
  authenticate(
    context: RequestContext,
  ): AuthSchemeAuthenticateResult<identity> | Promise<AuthSchemeAuthenticateResult<identity>>
}

type AuthSchemeIdentity<scheme> = scheme extends AuthScheme<infer identity> ? identity : never

type AuthForSchemes<schemes extends readonly AuthScheme<any>[]> = AuthState<
  AuthSchemeIdentity<schemes[number]>
>

/**
 * Options for loading auth state for each request.
 */
export interface AuthOptions<schemes extends readonly AuthScheme<any>[] = AuthScheme<any>[]> {
  /** Auth schemes to run in order for each request. */
  schemes: readonly [...schemes]
}

/**
 * Loads auth state for the current request by running each configured auth scheme in order.
 *
 * @param options Auth scheme configuration for the middleware.
 * @returns Middleware that resolves auth state into `context.get(Auth)`.
 */
export function auth<schemes extends readonly AuthScheme<any>[]>(
  options: AuthOptions<schemes>,
): Middleware<AuthContextEntry<AuthForSchemes<schemes>>> {
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
        } satisfies AuthState)

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
      } satisfies AuthState)

      return next()
    }

    context.set(Auth, {
      ok: false,
    } satisfies AuthState)

    return next()
  }
}

function createFailure(scheme: AuthScheme<any>, result: AuthSchemeFailure): AuthFailure {
  return {
    method: scheme.name,
    code: result.code ?? 'invalid_credentials',
    message: result.message ?? 'Invalid credentials',
    challenge: result.challenge,
  }
}
