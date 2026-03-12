import type { OIDCOptions, OIDCProfile, OAuthProvider } from '../types.ts'

import { createOIDCAuthProvider } from './oidc.ts'

/**
 * Profile claims returned by the built-in Okta auth provider.
 */
export interface OktaProfile extends OIDCProfile {}

/**
 * Options for creating the built-in Okta auth provider.
 */
export interface OktaOptions extends Omit<OIDCOptions<OktaProfile, 'okta'>, 'name'> {}

/**
 * Creates an Okta provider backed by the shared OIDC runtime.
 *
 * @param options Okta issuer and client settings for your application.
 * @returns An OAuth provider that can be passed to `login()` and `callback()`.
 */
export function createOktaAuthProvider(options: OktaOptions): OAuthProvider<OktaProfile, 'okta'> {
  return createOIDCAuthProvider({
    ...options,
    name: 'okta',
  })
}
