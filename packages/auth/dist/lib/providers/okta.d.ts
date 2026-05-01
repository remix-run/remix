import type { OAuthProvider, OAuthStandardTokens } from '../provider.ts';
import { type OIDCAuthProviderOptions, type OIDCAuthProfile } from './oidc.ts';
/**
 * Profile claims returned by the built-in Okta auth provider.
 */
export interface OktaAuthProfile extends OIDCAuthProfile {
}
/**
 * Options for creating the built-in Okta auth provider.
 */
export interface OktaAuthProviderOptions extends Omit<OIDCAuthProviderOptions<OktaAuthProfile, 'okta'>, 'name'> {
}
/**
 * Creates an Okta provider backed by the shared OIDC runtime.
 *
 * @param options Okta issuer and client settings for your application.
 * @returns An OAuth provider that can be passed to `startExternalAuth()` and `finishExternalAuth()`.
 */
export declare function createOktaAuthProvider(options: OktaAuthProviderOptions): OAuthProvider<OktaAuthProfile, 'okta', OAuthStandardTokens>;
//# sourceMappingURL=okta.d.ts.map