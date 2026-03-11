import type { RequestContext } from '@remix-run/fetch-router'

export interface AuthFailure {
  scheme?: string
  code: 'missing_credentials' | 'invalid_credentials'
  message: string
  challenge?: string
}

export interface AuthenticatedState<principal = unknown, scheme extends string = string> {
  authenticated: true
  principal: principal
  scheme: scheme
}

export interface UnauthenticatedState {
  authenticated: false
  error?: AuthFailure
}

export type AuthState<principal = unknown, scheme extends string = string> =
  | AuthenticatedState<principal, scheme>
  | UnauthenticatedState

export interface AuthSchemeSuccess<principal = unknown> {
  status: 'success'
  principal: principal
}

export interface AuthSchemeFailure {
  status: 'failure'
  code?: AuthFailure['code']
  message?: string
  challenge?: string
}

export type AuthSchemeResult<principal = unknown> =
  | AuthSchemeSuccess<principal>
  | AuthSchemeFailure

export type AuthSchemeAuthenticateResult<principal = unknown> =
  | AuthSchemeResult<principal>
  | null
  | undefined
  | void

export interface AuthScheme<principal = unknown, scheme extends string = string> {
  name: scheme
  authenticate(
    context: RequestContext,
  ): AuthSchemeAuthenticateResult<principal> | Promise<AuthSchemeAuthenticateResult<principal>>
}

export interface AuthOptions {
  schemes: AuthScheme[]
}

export interface RequireAuthOptions {
  onFailure?: (
    context: RequestContext,
    auth: UnauthenticatedState,
  ) => Response | Promise<Response>
  status?: number
  body?: BodyInit | null
  headers?: HeadersInit
}
