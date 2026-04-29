import { createOIDCAuthProvider, } from "./oidc.js";
/**
 * Creates an Okta provider backed by the shared OIDC runtime.
 *
 * @param options Okta issuer and client settings for your application.
 * @returns An OAuth provider that can be passed to `startExternalAuth()` and `finishExternalAuth()`.
 */
export function createOktaAuthProvider(options) {
    return createOIDCAuthProvider({
        ...options,
        name: 'okta',
    });
}
