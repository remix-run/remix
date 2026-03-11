import type { OIDCOptions, OIDCProfile, OAuthProvider } from '../types.ts'

import { createOIDCAuthProvider } from './oidc.ts'

export interface OktaProfile extends OIDCProfile {}

export interface OktaOptions extends Omit<OIDCOptions<OktaProfile, 'okta'>, 'name'> {}

export function createOktaAuthProvider(options: OktaOptions): OAuthProvider<OktaProfile, 'okta'> {
  return createOIDCAuthProvider({
    ...options,
    name: 'okta',
  })
}
