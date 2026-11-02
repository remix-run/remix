import type { OAuthProvider } from '../provider.ts';
import { type OIDCAuthProviderOptions, type OIDCAuthProfile } from './oidc.ts';
/**
 * Profile claims returned by the built-in Auth0 auth provider.
 */
export interface Auth0AuthProfile extends OIDCAuthProfile {
    /** Auth0 nickname claim, when available. */
    nickname?: string;
    /** Auth0 string timestamp describing the last profile update, when available. */
    updated_at?: string;
}
/**
 * Options for creating the built-in Auth0 auth provider.
 */
export interface Auth0AuthProviderOptions extends Omit<OIDCAuthProviderOptions<Auth0AuthProfile, 'auth0'>, 'name' | 'issuer'> {
    /** Auth0 tenant domain used to derive the issuer URL. */
    domain: string;
}
/**
 * Creates an Auth0 provider backed by the shared OIDC runtime.
 *
 * @param options Auth0 domain and client settings for your application.
 * @returns An OAuth provider that can be passed to `startExternalAuth()` and `finishExternalAuth()`.
 */
export declare function createAuth0AuthProvider(options: Auth0AuthProviderOptions): OAuthProvider<Auth0AuthProfile, 'auth0'>;
//# sourceMappingURL=auth0.d.ts.map