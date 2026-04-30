import type { OAuthProvider, OAuthStandardTokens } from '../provider.ts'

import {
  createOIDCAuthProvider,
  type OIDCAuthProviderOptions,
  type OIDCAuthProfile,
} from './oidc.ts'

/**
 * Profile claims returned by the built-in Microsoft auth provider.
 */
export interface MicrosoftAuthProfile extends OIDCAuthProfile {
  /** Microsoft tenant identifier, when available. */
  tid?: string
  /** Stable Microsoft object identifier, when available. */
  oid?: string
  /** Preferred username returned by Microsoft, when available. */
  preferred_username?: string
}

/**
 * Options for creating the built-in Microsoft auth provider.
 */
export interface MicrosoftAuthProviderOptions
  extends Omit<OIDCAuthProviderOptions<MicrosoftAuthProfile, 'microsoft'>, 'name' | 'issuer'> {
  /** Tenant segment used to build the Microsoft issuer URL. */
  tenant?: 'common' | 'organizations' | 'consumers' | string
}

/**
 * Creates a Microsoft identity platform provider backed by the shared OIDC runtime.
 *
 * @param options Microsoft client settings and optional tenant selection.
 * @returns An OAuth provider that can be passed to `startExternalAuth()` and `finishExternalAuth()`.
 */
export function createMicrosoftAuthProvider(
  options: MicrosoftAuthProviderOptions,
): OAuthProvider<MicrosoftAuthProfile, 'microsoft', OAuthStandardTokens> {
  return createOIDCAuthProvider({
    ...options,
    name: 'microsoft',
    issuer: `https://login.microsoftonline.com/${options.tenant ?? 'common'}/v2.0`,
  })
}
