import { createOIDCAuthProvider, } from "./oidc.js";
/**
 * Creates a Microsoft identity platform provider backed by the shared OIDC runtime.
 *
 * @param options Microsoft client settings and optional tenant selection.
 * @returns An OAuth provider that can be passed to `startExternalAuth()` and `finishExternalAuth()`.
 */
export function createMicrosoftAuthProvider(options) {
    return createOIDCAuthProvider({
        ...options,
        name: 'microsoft',
        issuer: `https://login.microsoftonline.com/${options.tenant ?? 'common'}/v2.0`,
    });
}
