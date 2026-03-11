import type { OAuthProvider } from '../types.ts'
import type { OAuthAccount, OAuthResult } from '../types.ts'
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

export interface FacebookOptions {
  clientId: string
  clientSecret: string
  redirectUri: string | URL
  scopes?: string[]
}

export interface FacebookPicture {
  data: {
    url: string
  }
}

export interface FacebookProfile {
  id: string
  name?: string
  email?: string
  picture?: FacebookPicture
}

export function facebook(options: FacebookOptions): OAuthProvider<FacebookProfile, 'facebook'> {
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
    async authenticate(context, transaction): Promise<OAuthResult<FacebookProfile, 'facebook'>> {
      let tokens = await exchangeAuthorizationCode({
        tokenEndpoint: FACEBOOK_TOKEN_ENDPOINT,
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        redirectUri: options.redirectUri,
        code: getAuthorizationCode(context),
        codeVerifier: transaction.codeVerifier,
      })
      let profile = await fetchJson<FacebookProfile>(
        FACEBOOK_PROFILE_ENDPOINT,
        {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        },
        'Failed to load Facebook profile.',
      )

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

function toURLString(value: string | URL): string {
  return typeof value === 'string' ? value : value.toString()
}
