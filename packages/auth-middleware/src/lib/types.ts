import { createContextKey, type RequestContext } from '@remix-run/fetch-router'

export interface AuthFailure {
  scheme?: string
  code: 'missing_credentials' | 'invalid_credentials'
  message: string
  challenge?: string
}

export interface AuthenticatedAuth<principal = unknown, scheme extends string = string> {
  ok: true
  principal: principal
  scheme: scheme
}

export interface UnauthenticatedAuth {
  ok: false
  error?: AuthFailure
}

export type Auth<principal = unknown, scheme extends string = string> =
  | AuthenticatedAuth<principal, scheme>
  | UnauthenticatedAuth

export const Auth = createContextKey<Auth>()

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
    auth: UnauthenticatedAuth,
  ) => Response | Promise<Response>
  status?: number
  body?: BodyInit | null
  headers?: HeadersInit
}
