import type { OAuthAccount, OAuthProvider, OAuthResult } from '../provider.ts'
import {
  createAuthorizationURL,
  createOAuthProvider,
  exchangeAuthorizationCode,
  fetchJson,
  getAuthorizationCode,
} from '../provider.ts'
import { createCodeChallenge } from '../utils.ts'

const FACEBOOK_AUTHORIZATION_ENDPOINT = 'https://www.facebook.com/dialog/oauth'
const FACEBOOK_TOKEN_ENDPOINT = 'https://graph.facebook.com/oauth/access_token'
const FACEBOOK_PROFILE_ENDPOINT = 'https://graph.facebook.com/me?fields=id,name,email,picture'
const DEFAULT_FACEBOOK_SCOPES = ['public_profile', 'email']

/**
 * Options for creating the built-in Facebook auth provider.
 */
export interface FacebookAuthProviderOptions {
  /** OAuth client identifier for your Facebook Login app. */
  clientId: string
  /** OAuth client secret for your Facebook Login app. */
  clientSecret: string
  /** Callback URL registered with Facebook Login. */
  redirectUri: string | URL
  /** Requested scopes for the Facebook login flow. */
  scopes?: string[]
}

/**
 * Nested picture payload returned by Facebook profile responses.
 */
export interface FacebookAuthProviderPicture {
  /** Nested image payload returned by Facebook. */
  data: {
    /** Resolved picture URL for the authenticated user. */
    url: string
  }
}

/**
 * Profile fields returned by the built-in Facebook auth provider.
 */
export interface FacebookAuthProfile {
  /** Stable Facebook user identifier. */
  id: string
  /** Display name returned by Facebook, when available. */
  name?: string
  /** Email address returned by Facebook, when available. */
  email?: string
  /** Nested profile picture payload returned by Facebook, when available. */
  picture?: FacebookAuthProviderPicture
}

/**
 * Creates a Facebook Login provider.
 *
 * @param options Facebook OAuth client settings for your application.
 * @returns An OAuth provider that can be passed to `login()` and `callback()`.
 */
export function createFacebookAuthProvider(options: FacebookAuthProviderOptions): OAuthProvider<FacebookAuthProfile, 'facebook'> {
  let scopes = options.scopes ?? DEFAULT_FACEBOOK_SCOPES

  return createOAuthProvider('facebook', {
    async createAuthorizationURL(transaction) {
      let challenge = await createCodeChallenge(transaction.codeVerifier)

      return createAuthorizationURL(FACEBOOK_AUTHORIZATION_ENDPOINT, {
        client_id: options.clientId,
        redirect_uri: toURLString(options.redirectUri),
        response_type: 'code',
        scope: scopes.join(' '),
        state: transaction.state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      })
    },
    async authenticate(context, transaction): Promise<OAuthResult<FacebookAuthProfile, 'facebook'>> {
      let tokens = await exchangeAuthorizationCode({
        tokenEndpoint: FACEBOOK_TOKEN_ENDPOINT,
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        redirectUri: options.redirectUri,
        code: getAuthorizationCode(context),
        codeVerifier: transaction.codeVerifier,
      })
      let profile = await fetchJson<FacebookAuthProfile>(
        FACEBOOK_PROFILE_ENDPOINT,
        {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        },
        'Failed to load Facebook profile.',
      )
      profile = validateFacebookProfile(profile)

      return {
        provider: 'facebook',
        account: createAccount('facebook', profile.id),
        profile,
        tokens,
      }
    },
  })
}

function createAccount(
  provider: 'facebook',
  providerAccountId: string,
): OAuthAccount<'facebook'> {
  return { provider, providerAccountId }
}

function validateFacebookProfile(profile: FacebookAuthProfile): FacebookAuthProfile {
  if (typeof profile.id !== 'string' || profile.id.length === 0) {
    throw new Error('Facebook profile did not include a valid id.')
  }

  return profile
}

function toURLString(value: string | URL): string {
  return typeof value === 'string' ? value : value.toString()
}
