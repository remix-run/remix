import type { OAuthProvider } from '../provider.ts';
import { type OIDCAuthProfile } from './oidc.ts';
/**
 * Options for creating the built-in Google auth provider.
 */
export interface GoogleAuthProviderOptions {
    /** OAuth client identifier for your Google application. */
    clientId: string;
    /** OAuth client secret for your Google application. */
    clientSecret: string;
    /** Callback URL registered with Google. */
    redirectUri: string | URL;
    /** Requested scopes for the Google login flow. */
    scopes?: string[];
}
/**
 * Profile claims returned by the built-in Google auth provider.
 */
export interface GoogleAuthProfile extends OIDCAuthProfile {
}
/**
 * Creates a Google auth provider backed by the shared OIDC runtime.
 *
 * @param options Google OAuth client settings for your application.
 * @returns An OAuth provider that can be passed to `startExternalAuth()` and `finishExternalAuth()`.
 */
export declare function createGoogleAuthProvider(options: GoogleAuthProviderOptions): OAuthProvider<GoogleAuthProfile, 'google'>;
//# sourceMappingURL=google.d.ts.map