import type { OAuthProvider } from '../provider.ts';
/**
 * Options for creating the built-in Facebook auth provider.
 */
export interface FacebookAuthProviderOptions {
    /** OAuth client identifier for your Facebook Login app. */
    clientId: string;
    /** OAuth client secret for your Facebook Login app. */
    clientSecret: string;
    /** Callback URL registered with Facebook Login. */
    redirectUri: string | URL;
    /** Requested scopes for the Facebook login flow. */
    scopes?: string[];
}
/**
 * Nested picture payload returned by Facebook profile responses.
 */
export interface FacebookAuthProviderPicture {
    /** Nested image payload returned by Facebook. */
    data: {
        /** Resolved picture URL for the authenticated user. */
        url: string;
    };
}
/**
 * Profile fields returned by the built-in Facebook auth provider.
 */
export interface FacebookAuthProfile {
    /** Stable Facebook user identifier. */
    id: string;
    /** Display name returned by Facebook, when available. */
    name?: string;
    /** Email address returned by Facebook, when available. */
    email?: string;
    /** Nested profile picture payload returned by Facebook, when available. */
    picture?: FacebookAuthProviderPicture;
}
/**
 * Creates a Facebook Login provider.
 *
 * @param options Facebook OAuth client settings for your application.
 * @returns An OAuth provider that can be passed to `startExternalAuth()` and `finishExternalAuth()`.
 */
export declare function createFacebookAuthProvider(options: FacebookAuthProviderOptions): OAuthProvider<FacebookAuthProfile, 'facebook'>;
//# sourceMappingURL=facebook.d.ts.map