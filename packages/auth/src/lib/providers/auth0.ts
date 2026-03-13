import type { OAuthProvider } from '../provider.ts'

import { createOIDCAuthProvider, type OIDCAuthProviderOptions, type OIDCAuthProfile } from './oidc.ts'

/**
 * Profile claims returned by the built-in Auth0 auth provider.
 */
export interface Auth0AuthProfile extends OIDCAuthProfile {
  /** Auth0 nickname claim, when available. */
  nickname?: string
  /** Auth0 string timestamp describing the last profile update, when available. */
  updated_at?: string
}

/**
 * Options for creating the built-in Auth0 auth provider.
 */
export interface Auth0AuthProviderOptions
  extends Omit<OIDCAuthProviderOptions<Auth0AuthProfile, 'auth0'>, 'name' | 'issuer'> {
  /** Auth0 tenant domain used to derive the issuer URL. */
  domain: string
}

/**
 * Creates an Auth0 provider backed by the shared OIDC runtime.
 *
 * @param options Auth0 domain and client settings for your application.
 * @returns An OAuth provider that can be passed to `login()` and `callback()`.
 */
export function createAuth0AuthProvider(options: Auth0AuthProviderOptions): OAuthProvider<Auth0AuthProfile, 'auth0'> {
  let issuer = createAuth0Issuer(options.domain)

  return createOIDCAuthProvider({
    ...options,
    name: 'auth0',
    issuer,
  })
}

function createAuth0Issuer(domain: string): string {
  let url = new URL(domain.startsWith('http://') || domain.startsWith('https://') ? domain : `https://${domain}`)
  url.pathname = '/'
  url.search = ''
  url.hash = ''
  return url.toString()
}
