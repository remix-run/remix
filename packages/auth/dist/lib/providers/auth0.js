import { createOIDCAuthProvider, } from "./oidc.js";
/**
 * Creates an Auth0 provider backed by the shared OIDC runtime.
 *
 * @param options Auth0 domain and client settings for your application.
 * @returns An OAuth provider that can be passed to `startExternalAuth()` and `finishExternalAuth()`.
 */
export function createAuth0AuthProvider(options) {
    let issuer = createAuth0Issuer(options.domain);
    return createOIDCAuthProvider({
        ...options,
        name: 'auth0',
        issuer,
    });
}
function createAuth0Issuer(domain) {
    let url = new URL(domain.startsWith('http://') || domain.startsWith('https://') ? domain : `https://${domain}`);
    url.pathname = '/';
    url.search = '';
    url.hash = '';
    return url.toString();
}
