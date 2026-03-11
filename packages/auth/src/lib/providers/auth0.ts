import type { OIDCOptions, OIDCProfile, OAuthProvider } from '../types.ts'

import { createOIDCAuthProvider } from './oidc.ts'

export interface Auth0Profile extends OIDCProfile {
  nickname?: string
  updated_at?: string
}

export interface Auth0Options
  extends Omit<OIDCOptions<Auth0Profile, 'auth0'>, 'name' | 'issuer'> {
  domain: string
}

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
