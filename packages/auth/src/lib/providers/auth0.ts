import type { OAuthProvider } from '../provider.ts'

import { createOIDCAuthProvider, type OIDCOptions, type OIDCProfile } from './oidc.ts'

/**
 * Profile claims returned by the built-in Auth0 auth provider.
 */
export interface Auth0Profile extends OIDCProfile {
  nickname?: string
  updated_at?: string
}

/**
 * Options for creating the built-in Auth0 auth provider.
 */
export interface Auth0Options
  extends Omit<OIDCOptions<Auth0Profile, 'auth0'>, 'name' | 'issuer'> {
  domain: string
}

/**
 * Creates an Auth0 provider backed by the shared OIDC runtime.
 *
 * @param options Auth0 domain and client settings for your application.
 * @returns An OAuth provider that can be passed to `login()` and `callback()`.
 */
export function createAuth0AuthProvider(options: Auth0Options): OAuthProvider<Auth0Profile, 'auth0'> {
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
