import type { OAuthProvider } from '../provider.ts';
/**
 * Options for creating the built-in X auth provider.
 */
export interface XAuthProviderOptions {
    /** OAuth client identifier for your X application. */
    clientId: string;
    /** OAuth client secret for your X application. */
    clientSecret: string;
    /** Callback URL registered with X. */
    redirectUri: string | URL;
    /** Requested scopes for the X login flow. */
    scopes?: string[];
}
/**
 * Profile fields returned by the built-in X auth provider.
 */
export interface XAuthProfile {
    /** Stable X user identifier. */
    id: string;
    /** Display name returned by X. */
    name: string;
    /** X username returned by the provider. */
    username: string;
    /** Profile image URL returned by X, when available. */
    profile_image_url?: string;
    /** Indicates whether the account is verified, when available. */
    verified?: boolean;
    /** Bio text returned by X, when available. */
    description?: string;
    /** Profile URL returned by X, when available. */
    url?: string;
}
/**
 * Creates an X auth provider using OAuth 2.0 Authorization Code with PKCE.
 *
 * @param options X client settings for your application.
 * @returns An OAuth provider that can be passed to `startExternalAuth()` and `finishExternalAuth()`.
 */
export declare function createXAuthProvider(options: XAuthProviderOptions): OAuthProvider<XAuthProfile, 'x'>;
//# sourceMappingURL=x.d.ts.map