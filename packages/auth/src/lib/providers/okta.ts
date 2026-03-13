import type { OAuthProvider } from '../provider.ts'

import { createOIDCAuthProvider, type OIDCAuthProviderOptions, type OIDCAuthProviderProfile } from './oidc.ts'

/**
 * Profile claims returned by the built-in Okta auth provider.
 */
export interface OktaAuthProviderProfile extends OIDCAuthProviderProfile {}

/**
 * Options for creating the built-in Okta auth provider.
 */
export interface OktaAuthProviderOptions extends Omit<OIDCAuthProviderOptions<OktaAuthProviderProfile, 'okta'>, 'name'> {}

/**
 * Creates an Okta provider backed by the shared OIDC runtime.
 *
 * @param options Okta issuer and client settings for your application.
 * @returns An OAuth provider that can be passed to `login()` and `callback()`.
 */
export function createOktaAuthProvider(options: OktaAuthProviderOptions): OAuthProvider<OktaAuthProviderProfile, 'okta'> {
  return createOIDCAuthProvider({
    ...options,
    name: 'okta',
  })
}
