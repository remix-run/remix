import { createContextKey, type RequestContext } from '@remix-run/fetch-router'

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
export interface AuthScheme<identity = unknown, scheme extends string = string> {
  name: scheme
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
