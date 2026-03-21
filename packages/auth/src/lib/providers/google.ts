import type { OAuthProvider } from '../provider.ts'

import {
  createOIDCAuthProvider,
  type OIDCAuthProviderMetadata,
  type OIDCAuthProfile,
} from './oidc.ts'

const GOOGLE_ISSUER = 'https://accounts.google.com'
const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo'
const DEFAULT_GOOGLE_SCOPES = ['openid', 'email', 'profile']

const GOOGLE_METADATA: OIDCAuthProviderMetadata = {
  issuer: GOOGLE_ISSUER,
  authorization_endpoint: GOOGLE_AUTHORIZATION_ENDPOINT,
  token_endpoint: GOOGLE_TOKEN_ENDPOINT,
  userinfo_endpoint: GOOGLE_USERINFO_ENDPOINT,
}

/**
 * Options for creating the built-in Google auth provider.
 */
export interface GoogleAuthProviderOptions {
  /** OAuth client identifier for your Google application. */
  clientId: string
  /** OAuth client secret for your Google application. */
  clientSecret: string
  /** Callback URL registered with Google. */
  redirectUri: string | URL
  /** Requested scopes for the Google login flow. */
  scopes?: string[]
}

/**
 * Profile claims returned by the built-in Google auth provider.
 */
export interface GoogleAuthProfile extends OIDCAuthProfile {}

/**
 * Creates a Google auth provider backed by the shared OIDC runtime.
 *
 * @param options Google OAuth client settings for your application.
 * @returns An OAuth provider that can be passed to `startExternalAuth()` and `finishExternalAuth()`.
 */
export function createGoogleAuthProvider(
  options: GoogleAuthProviderOptions,
): OAuthProvider<GoogleAuthProfile, 'google'> {
  return createOIDCAuthProvider({
    ...options,
    name: 'google',
    issuer: GOOGLE_ISSUER,
    metadata: GOOGLE_METADATA,
    scopes: options.scopes ?? DEFAULT_GOOGLE_SCOPES,
  })
}
