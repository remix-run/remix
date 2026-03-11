import type { OAuthProvider } from '../types.ts'
import type { OAuthAccount, OAuthResult } from '../types.ts'
import { createAuthorizationURL, createOAuthProvider, exchangeAuthorizationCode, fetchJson, getAuthorizationCode } from '../provider.ts'
import { createCodeChallenge } from '../utils.ts'

const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo'
const DEFAULT_GOOGLE_SCOPES = ['openid', 'email', 'profile']

export interface GoogleOptions {
  clientId: string
  clientSecret: string
  redirectUri: string | URL
  scopes?: string[]
}

export interface GoogleProfile {
  sub: string
  email?: string
  email_verified?: boolean
  name?: string
  given_name?: string
  family_name?: string
  picture?: string
  locale?: string
}

export function google(options: GoogleOptions): OAuthProvider<GoogleProfile, 'google'> {
  let scopes = options.scopes ?? DEFAULT_GOOGLE_SCOPES

  return createOAuthProvider('google', {
    async createAuthorizationURL(transaction) {
      let challenge = await createCodeChallenge(transaction.codeVerifier)

      return createAuthorizationURL(GOOGLE_AUTHORIZATION_ENDPOINT, {
        client_id: options.clientId,
        redirect_uri: toURLString(options.redirectUri),
        response_type: 'code',
        scope: scopes.join(' '),
        state: transaction.state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      })
    },
    async authenticate(context, transaction): Promise<OAuthResult<GoogleProfile, 'google'>> {
      let tokens = await exchangeAuthorizationCode({
        tokenEndpoint: GOOGLE_TOKEN_ENDPOINT,
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        redirectUri: options.redirectUri,
        code: getAuthorizationCode(context),
        codeVerifier: transaction.codeVerifier,
      })
      let profile = await fetchJson<GoogleProfile>(
        GOOGLE_USERINFO_ENDPOINT,
        {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        },
        'Failed to load Google profile.',
      )

      return {
        provider: 'google',
        account: createAccount('google', profile.sub),
        profile,
        tokens,
      }
    },
  })
}

function createAccount(provider: 'google', providerAccountId: string): OAuthAccount<'google'> {
  return { provider, providerAccountId }
}

function toURLString(value: string | URL): string {
  return typeof value === 'string' ? value : value.toString()
}
