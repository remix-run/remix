import type { OIDCOptions, OIDCProfile, OAuthProvider } from '../types.ts'

import { createOIDCAuthProvider } from './oidc.ts'

/**
 * Profile claims returned by the built-in Microsoft auth provider.
 */
export interface MicrosoftProfile extends OIDCProfile {
  tid?: string
  oid?: string
  preferred_username?: string
}

/**
 * Options for creating the built-in Microsoft auth provider.
 */
export interface MicrosoftOptions
  extends Omit<OIDCOptions<MicrosoftProfile, 'microsoft'>, 'name' | 'issuer'> {
  tenant?: 'common' | 'organizations' | 'consumers' | string
}

/**
 * Creates a Microsoft identity platform provider backed by the shared OIDC runtime.
 *
 * @param options Microsoft client settings and optional tenant selection.
 * @returns An OAuth provider that can be passed to `login()` and `callback()`.
 */
export function createMicrosoftAuthProvider(
  options: MicrosoftOptions,
): OAuthProvider<MicrosoftProfile, 'microsoft'> {
  return createOIDCAuthProvider({
    ...options,
    name: 'microsoft',
    issuer: `https://login.microsoftonline.com/${options.tenant ?? 'common'}/v2.0`,
  })
}
