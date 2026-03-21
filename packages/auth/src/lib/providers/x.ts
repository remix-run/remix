import type { OAuthAccount, OAuthProvider, OAuthResult } from '../provider.ts'
import {
  createAuthorizationURL,
  createOAuthProvider,
  exchangeAuthorizationCode,
  fetchJson,
  getAuthorizationCode,
} from '../provider.ts'
import { createCodeChallenge } from '../utils.ts'

const X_AUTHORIZATION_ENDPOINT = 'https://x.com/i/oauth2/authorize'
const X_TOKEN_ENDPOINT = 'https://api.x.com/2/oauth2/token'
const X_PROFILE_ENDPOINT =
  'https://api.x.com/2/users/me?user.fields=profile_image_url,verified,description,url'
const DEFAULT_X_SCOPES = ['tweet.read', 'users.read']

/**
 * Options for creating the built-in X auth provider.
 */
export interface XAuthProviderOptions {
  /** OAuth client identifier for your X application. */
  clientId: string
  /** OAuth client secret for your X application. */
  clientSecret: string
  /** Callback URL registered with X. */
  redirectUri: string | URL
  /** Requested scopes for the X login flow. */
  scopes?: string[]
}

/**
 * Profile fields returned by the built-in X auth provider.
 */
export interface XAuthProfile {
  /** Stable X user identifier. */
  id: string
  /** Display name returned by X. */
  name: string
  /** X username returned by the provider. */
  username: string
  /** Profile image URL returned by X, when available. */
  profile_image_url?: string
  /** Indicates whether the account is verified, when available. */
  verified?: boolean
  /** Bio text returned by X, when available. */
  description?: string
  /** Profile URL returned by X, when available. */
  url?: string
}

interface XProfileResponse {
  data: XAuthProfile
}

/**
 * Creates an X auth provider using OAuth 2.0 Authorization Code with PKCE.
 *
 * @param options X client settings for your application.
 * @returns An OAuth provider that can be passed to `startExternalAuth()` and `finishExternalAuth()`.
 */
export function createXAuthProvider(
  options: XAuthProviderOptions,
): OAuthProvider<XAuthProfile, 'x'> {
  let scopes = options.scopes ?? DEFAULT_X_SCOPES

  return createOAuthProvider('x', {
    async createAuthorizationURL(transaction) {
      let challenge = await createCodeChallenge(transaction.codeVerifier)

      return createAuthorizationURL(X_AUTHORIZATION_ENDPOINT, {
        client_id: options.clientId,
        redirect_uri: toURLString(options.redirectUri),
        response_type: 'code',
        scope: scopes.join(' '),
        state: transaction.state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      })
    },
    async handleCallback(context, transaction): Promise<OAuthResult<XAuthProfile, 'x'>> {
      let tokens = await exchangeAuthorizationCode({
        tokenEndpoint: X_TOKEN_ENDPOINT,
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        redirectUri: options.redirectUri,
        code: getAuthorizationCode(context),
        codeVerifier: transaction.codeVerifier,
        clientAuthentication: 'basic',
      })
      let response = await fetchJson<XProfileResponse>(
        X_PROFILE_ENDPOINT,
        {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        },
        'Failed to load X profile.',
      )
      let profile = validateXProfile(response)

      return {
        provider: 'x',
        account: createAccount('x', profile.id),
        profile,
        tokens,
      }
    },
  })
}

function createAccount(provider: 'x', providerAccountId: string): OAuthAccount<'x'> {
  return { provider, providerAccountId }
}

function validateXProfile(response: XProfileResponse): XAuthProfile {
  let profile = response.data

  if (typeof profile?.id !== 'string' || profile.id.length === 0) {
    throw new Error('X profile did not include a valid id.')
  }

  if (typeof profile.username !== 'string' || profile.username.length === 0) {
    throw new Error('X profile did not include a valid username.')
  }

  if (typeof profile.name !== 'string' || profile.name.length === 0) {
    throw new Error('X profile did not include a valid name.')
  }

  return profile
}

function toURLString(value: string | URL): string {
  return typeof value === 'string' ? value : value.toString()
}
