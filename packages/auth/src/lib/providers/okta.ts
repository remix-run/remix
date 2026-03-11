import type { OIDCOptions, OIDCProfile, OAuthProvider } from '../types.ts'

import { oidc } from './oidc.ts'

export interface OktaProfile extends OIDCProfile {}

export interface OktaOptions extends Omit<OIDCOptions<OktaProfile, 'okta'>, 'name'> {}

export function okta(options: OktaOptions): OAuthProvider<OktaProfile, 'okta'> {
  return oidc({
    ...options,
    name: 'okta',
  })
}
