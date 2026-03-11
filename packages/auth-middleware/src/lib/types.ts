import { createContextKey, type RequestContext } from '@remix-run/fetch-router'

export interface AuthFailure {
  scheme?: string
  code: 'missing_credentials' | 'invalid_credentials'
  message: string
  challenge?: string
}

export interface AuthenticatedAuth<identity = unknown, scheme extends string = string> {
  ok: true
  identity: identity
  scheme: scheme
}

export interface UnauthenticatedAuth {
  ok: false
  error?: AuthFailure
}

export type Auth<identity = unknown, scheme extends string = string> =
  | AuthenticatedAuth<identity, scheme>
  | UnauthenticatedAuth

export const Auth = createContextKey<Auth>()

export interface AuthSchemeSuccess<identity = unknown> {
  status: 'success'
  identity: identity
}

export interface AuthSchemeFailure {
  status: 'failure'
  code?: AuthFailure['code']
  message?: string
  challenge?: string
}

export type AuthSchemeResult<identity = unknown> =
  | AuthSchemeSuccess<identity>
  | AuthSchemeFailure

export type AuthSchemeAuthenticateResult<identity = unknown> =
  | AuthSchemeResult<identity>
  | null
  | undefined
  | void

export interface AuthScheme<identity = unknown, scheme extends string = string> {
  name: scheme
  authenticate(
    context: RequestContext,
  ): AuthSchemeAuthenticateResult<identity> | Promise<AuthSchemeAuthenticateResult<identity>>
}

export interface AuthOptions {
  schemes: AuthScheme[]
}

export interface RequireAuthOptions {
  onFailure?: (
    context: RequestContext,
    auth: UnauthenticatedAuth,
  ) => Response | Promise<Response>
  status?: number
  body?: BodyInit | null
  headers?: HeadersInit
}
