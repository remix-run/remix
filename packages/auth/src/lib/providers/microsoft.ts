import type { OIDCOptions, OIDCProfile, OAuthProvider } from '../types.ts'

import { oidc } from './oidc.ts'

export interface MicrosoftProfile extends OIDCProfile {
  tid?: string
  oid?: string
  preferred_username?: string
}

export interface MicrosoftOptions
  extends Omit<OIDCOptions<MicrosoftProfile, 'microsoft'>, 'name' | 'issuer'> {
  tenant?: 'common' | 'organizations' | 'consumers' | string
}

export function microsoft(
  options: MicrosoftOptions,
): OAuthProvider<MicrosoftProfile, 'microsoft'> {
  return oidc({
    ...options,
    name: 'microsoft',
    issuer: `https://login.microsoftonline.com/${options.tenant ?? 'common'}/v2.0`,
  })
}
