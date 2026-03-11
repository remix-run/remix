import type { RequestContext } from '@remix-run/fetch-router'

export interface SessionAuthData {
  [key: string]: unknown
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

export interface OIDCMetadata {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  userinfo_endpoint?: string
  jwks_uri?: string
  end_session_endpoint?: string
  scopes_supported?: string[]
  claims_supported?: string[]
  code_challenge_methods_supported?: string[]
}

export interface OIDCProfile {
  sub: string
  name?: string
  given_name?: string
  family_name?: string
  middle_name?: string
  nickname?: string
  preferred_username?: string
  profile?: string
  picture?: string
  website?: string
  email?: string
  email_verified?: boolean
  gender?: string
  birthdate?: string
  zoneinfo?: string
  locale?: string
  phone_number?: string
  phone_number_verified?: boolean
  updated_at?: number | string
  [key: string]: unknown
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

export interface OIDCOptions<
  profile extends OIDCProfile = OIDCProfile,
  provider extends string = 'oidc',
> {
  name?: provider
  issuer: string | URL
  clientId: string
  clientSecret: string
  redirectUri: string | URL
  scopes?: string[]
  discoveryUrl?: string | URL
  metadata?: OIDCMetadata
  authorizationParams?: Record<string, string | undefined>
  mapProfile?(input: {
    claims: OIDCProfile
    tokens: OAuthTokens
    metadata: OIDCMetadata
    context: RequestContext
  }): profile | Promise<profile>
}

export interface CredentialsProvider<input, result, provider extends string = string> {
  kind: 'credentials'
  name: provider
  parse(context: RequestContext): input | Promise<input>
  verify(input: input, context: RequestContext): result | null | Promise<result | null>
}

export interface LoginOptions<result, session_auth extends SessionAuthData = SessionAuthData> {
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
  session_auth extends SessionAuthData = SessionAuthData,
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
