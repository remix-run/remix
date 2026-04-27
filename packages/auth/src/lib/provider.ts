import type { RequestContext } from '@remix-run/fetch-router'

/**
 * OAuth and OIDC tokens returned from a successful authorization code exchange.
 */
export interface OAuthTokens {
  /** Access token returned by the provider. */
  accessToken: string
  /** Refresh token returned by the provider, when available. */
  refreshToken?: string
  /** Token type returned by the provider, such as `Bearer`. */
  tokenType?: string
  /** Expiration time derived from the provider token response, when available. */
  expiresAt?: Date
  /** Scopes granted to the current access token, when provided by the provider. */
  scope?: string[]
  /** OpenID Connect ID token returned by the provider, when available. */
  idToken?: string
}

/**
 * Stable account identifier for a provider-backed identity.
 */
export interface OAuthAccount<provider extends string = string> {
  /** Provider name that issued the account identifier. */
  provider: provider
  /** Stable provider-specific account identifier for the authenticated user. */
  providerAccountId: string
}

/**
 * Normalized result returned by OAuth and OIDC callback handlers.
 */
export interface OAuthResult<profile, provider extends string = string> {
  /** Provider name that completed the callback flow. */
  provider: provider
  /** Stable provider-backed account identity for the authenticated user. */
  account: OAuthAccount<provider>
  /** Normalized profile data returned by the provider. */
  profile: profile
  /** Tokens returned by the provider for the completed authorization flow. */
  tokens: OAuthTokens
}

/**
 * Public shape for an OAuth or OIDC provider used by external auth request handlers.
 */
export interface OAuthProvider<profile, provider extends string = string> {
  /** Provider name used for routing, callbacks, and persisted transactions. */
  name: provider
}

export interface OAuthTransaction {
  provider: string
  state: string
  codeVerifier: string
  returnTo?: string
}

export interface OAuthProviderRuntime<profile, provider extends string = string> {
  createAuthorizationURL(transaction: OAuthTransaction): URL | Promise<URL>
  handleCallback(
    context: RequestContext,
    transaction: OAuthTransaction,
  ): Promise<OAuthResult<profile, provider>>
  refreshTokens?(tokens: OAuthTokens): Promise<OAuthTokens>
}

export const oauthProviderRuntime = Symbol('oauth-provider-runtime')

export type InternalOAuthProvider<profile, provider extends string = string> = OAuthProvider<
  profile,
  provider
> & {
  [oauthProviderRuntime]: OAuthProviderRuntime<profile, provider>
}

interface ExchangeTokenOptionsBase {
  tokenEndpoint: string | URL
  clientId: string
  clientSecret: string
  clientAuthentication?: 'request-body' | 'basic'
  headers?: HeadersInit
}

export interface ExchangeAuthorizationCodeOptions extends ExchangeTokenOptionsBase {
  redirectUri: string | URL
  code: string
  codeVerifier: string
}

export interface ExchangeRefreshTokenOptions extends ExchangeTokenOptionsBase {
  refreshToken: string
  scopes?: string[]
}

export function createOAuthProvider<profile, provider extends string>(
  name: provider,
  runtime: OAuthProviderRuntime<profile, provider>,
): OAuthProvider<profile, provider> {
  return {
    name,
    [oauthProviderRuntime]: runtime,
  } as InternalOAuthProvider<profile, provider>
}

export function getOAuthProviderRuntime<profile, provider extends string>(
  provider: OAuthProvider<profile, provider>,
): OAuthProviderRuntime<profile, provider> {
  let runtime = (provider as InternalOAuthProvider<profile, provider>)[oauthProviderRuntime]
  if (runtime == null) {
    throw new Error(`Invalid OAuth provider "${provider.name}".`)
  }

  return runtime
}

export function createAuthorizationURL(
  endpoint: string | URL,
  params: Record<string, string | undefined>,
): URL {
  let url = new URL(endpoint)

  for (let [key, value] of Object.entries(params)) {
    if (value != null) {
      url.searchParams.set(key, value)
    }
  }

  return url
}

export async function exchangeAuthorizationCode(
  options: ExchangeAuthorizationCodeOptions,
): Promise<OAuthTokens> {
  return exchangeOAuthTokens(
    {
      ...options,
      fallbackError: 'OAuth token exchange failed.',
    },
    new URLSearchParams({
      code: options.code,
      code_verifier: options.codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: toURLString(options.redirectUri),
    }),
  )
}

export async function exchangeRefreshToken(
  options: ExchangeRefreshTokenOptions,
): Promise<OAuthTokens> {
  let params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: options.refreshToken,
  })

  if (options.scopes != null && options.scopes.length > 0) {
    params.set('scope', options.scopes.join(' '))
  }

  return exchangeOAuthTokens(
    {
      ...options,
      fallbackError: 'OAuth refresh token exchange failed.',
    },
    params,
  )
}

export function mergeRefreshedTokens(
  currentTokens: OAuthTokens,
  refreshedTokens: OAuthTokens,
): OAuthTokens {
  return {
    ...currentTokens,
    ...refreshedTokens,
    refreshToken: refreshedTokens.refreshToken ?? currentTokens.refreshToken,
    tokenType: refreshedTokens.tokenType ?? currentTokens.tokenType,
    expiresAt: refreshedTokens.expiresAt ?? currentTokens.expiresAt,
    scope: refreshedTokens.scope ?? currentTokens.scope,
    idToken: refreshedTokens.idToken ?? currentTokens.idToken,
  }
}

export async function fetchJson<json>(
  input: RequestInfo | URL,
  init: RequestInit,
  fallbackError: string,
): Promise<json> {
  let response = await fetch(input, init)
  let json = await readJson(response)

  if (!response.ok || hasOAuthError(json)) {
    throw new Error(getOAuthErrorMessage(json, fallbackError))
  }

  return json as json
}

export function getAuthorizationCode(context: RequestContext): string {
  let code = context.url.searchParams.get('code')
  if (code == null || code.length === 0) {
    throw new Error('Missing authorization code in OAuth callback request.')
  }

  return code
}

async function exchangeOAuthTokens(
  options: ExchangeTokenOptionsBase & { fallbackError: string },
  params: URLSearchParams,
): Promise<OAuthTokens> {
  let clientAuthentication = options.clientAuthentication ?? 'request-body'

  if (clientAuthentication === 'request-body') {
    params.set('client_id', options.clientId)
    params.set('client_secret', options.clientSecret)
  }

  let response = await fetch(options.tokenEndpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(clientAuthentication === 'basic'
        ? {
            Authorization: `Basic ${encodeBasicAuth(options.clientId, options.clientSecret)}`,
          }
        : undefined),
      ...options.headers,
    },
    body: params,
  })
  let json = await readJson(response)

  if (!response.ok || hasOAuthError(json)) {
    throw new Error(getOAuthErrorMessage(json, options.fallbackError))
  }

  return normalizeOAuthTokenResponse(json)
}

function normalizeOAuthTokenResponse(json: unknown): OAuthTokens {
  if (typeof json !== 'object' || json == null || Array.isArray(json)) {
    throw new Error('Expected OAuth provider to return a JSON object.')
  }

  let data = json as Record<string, unknown>

  if (typeof data.access_token !== 'string' || data.access_token.length === 0) {
    throw new Error('OAuth token response did not include an access token.')
  }

  return {
    accessToken: data.access_token,
    refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : undefined,
    tokenType: typeof data.token_type === 'string' ? data.token_type : undefined,
    expiresAt:
      typeof data.expires_in === 'number'
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
    scope: parseScope(data.scope),
    idToken: typeof data.id_token === 'string' ? data.id_token : undefined,
  }
}

function getOAuthErrorMessage(json: unknown, fallback: string): string {
  if (typeof json !== 'object' || json == null || Array.isArray(json)) {
    return fallback
  }

  let data = json as Record<string, unknown>

  if (typeof data.error_description === 'string' && data.error_description.length > 0) {
    return data.error_description
  }

  if (typeof data.error === 'string' && data.error.length > 0) {
    return data.error
  }

  if (typeof data.message === 'string' && data.message.length > 0) {
    return data.message
  }

  return fallback
}

function hasOAuthError(json: unknown): boolean {
  if (typeof json !== 'object' || json == null || Array.isArray(json)) {
    return false
  }

  let data = json as Record<string, unknown>

  return typeof data.error === 'string' || typeof data.error_description === 'string'
}

function parseScope(value: unknown): string[] | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return
  }

  return value
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0)
}

async function readJson(response: Response): Promise<unknown> {
  let text = await response.text()
  if (text.length === 0) {
    return {}
  }

  return JSON.parse(text)
}

function toURLString(value: string | URL): string {
  return typeof value === 'string' ? value : value.toString()
}

function encodeBasicAuth(clientId: string, clientSecret: string): string {
  return btoa(`${clientId}:${clientSecret}`)
}
