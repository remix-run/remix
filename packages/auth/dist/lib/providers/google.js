import { createOIDCAuthProvider, } from "./oidc.js";
const GOOGLE_ISSUER = 'https://accounts.google.com';
const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';
const DEFAULT_GOOGLE_SCOPES = ['openid', 'email', 'profile'];
const GOOGLE_METADATA = {
    issuer: GOOGLE_ISSUER,
    authorization_endpoint: GOOGLE_AUTHORIZATION_ENDPOINT,
    token_endpoint: GOOGLE_TOKEN_ENDPOINT,
    userinfo_endpoint: GOOGLE_USERINFO_ENDPOINT,
};
/**
 * Creates a Google auth provider backed by the shared OIDC runtime.
 *
 * @param options Google OAuth client settings for your application.
 * @returns An OAuth provider that can be passed to `startExternalAuth()` and `finishExternalAuth()`.
 */
export function createGoogleAuthProvider(options) {
    return createOIDCAuthProvider({
        ...options,
        name: 'google',
        issuer: GOOGLE_ISSUER,
        metadata: GOOGLE_METADATA,
        scopes: options.scopes ?? DEFAULT_GOOGLE_SCOPES,
    });
}
