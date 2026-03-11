import type { RequestContext } from '@remix-run/fetch-router'

export interface AuthSessionRecord<method extends string = string> {
  userId: string
  method: method
}

export interface OAuthTokens {
  accessToken: string
  refreshToken?: string
  tokenType?: string
  expiresAt?: Date
  scope?: string[]
  idToken?: string
}

export interface OAuthAccount<provider extends string = string> {
  provider: provider
  providerAccountId: string
}

export interface OAuthResult<profile, provider extends string = string> {
  provider: provider
  account: OAuthAccount<provider>
  profile: profile
  tokens: OAuthTokens
}

export interface OAuthProvider<profile, provider extends string = string> {
  kind: 'oauth'
  name: provider
}

export interface CredentialsProvider<input, result, provider extends string = string> {
  kind: 'credentials'
  name: provider
  parse(context: RequestContext): input | Promise<input>
  verify(input: input, context: RequestContext): result | null | Promise<result | null>
}

export interface LoginOptions<
  result,
  session_auth extends AuthSessionRecord = AuthSessionRecord,
> {
  sessionKey?: string
  createSessionAuth(
    result: result,
    context: RequestContext,
  ): session_auth | Promise<session_auth>
  successRedirectTo?: string | URL
  failureRedirectTo?: string | URL
  onSuccess?(
    result: result,
    sessionAuth: session_auth,
    context: RequestContext,
  ): Response | Promise<Response>
  onFailure?(context: RequestContext): Response | Promise<Response>
  onError?(error: unknown, context: RequestContext): Response | Promise<Response>
}

export interface OAuthLoginOptions {
  sessionKey?: string
  transactionKey?: string
  returnToParam?: string
  failureRedirectTo?: string | URL
  onError?(error: unknown, context: RequestContext): Response | Promise<Response>
}

export interface CallbackOptions<
  profile,
  provider extends string,
  session_auth extends AuthSessionRecord = AuthSessionRecord<provider>,
> {
  sessionKey?: string
  transactionKey?: string
  createSessionAuth(
    result: OAuthResult<profile, provider>,
    context: RequestContext,
  ): session_auth | Promise<session_auth>
  successRedirectTo?: string | URL
  failureRedirectTo?: string | URL
  onSuccess?(
    result: OAuthResult<profile, provider>,
    sessionAuth: session_auth,
    context: RequestContext,
  ): Response | Promise<Response>
  onFailure?(error: unknown, context: RequestContext): Response | Promise<Response>
}

export interface OAuthTransaction {
  provider: string
  state: string
  codeVerifier: string
  returnTo?: string
}

export interface OAuthProviderRuntime<profile, provider extends string = string> {
  createAuthorizationURL(transaction: OAuthTransaction): URL | Promise<URL>
  authenticate(
    context: RequestContext,
    transaction: OAuthTransaction,
  ): Promise<OAuthResult<profile, provider>>
}

export const oauthProviderRuntime = Symbol('oauth-provider-runtime')

export type InternalOAuthProvider<profile, provider extends string = string> =
  OAuthProvider<profile, provider> & {
    [oauthProviderRuntime]: OAuthProviderRuntime<profile, provider>
  }
