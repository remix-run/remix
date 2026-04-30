import { getOAuthProviderRuntime } from "./provider.js";
/**
 * Refreshes an OAuth or OIDC token bundle with the provider's refresh-token flow.
 *
 * @param provider The external provider that issued the original token bundle.
 * @param tokens The current provider token bundle, including a refresh token when available.
 * @returns The provider name plus the refreshed token bundle.
 */
export async function refreshExternalAuth(provider, tokens) {
    let runtime = getOAuthProviderRuntime(provider);
    if (runtime.refreshTokens == null) {
        throw new Error(`OAuth provider "${provider.name}" does not support refresh-token exchange.`);
    }
    return {
        provider: provider.name,
        tokens: await runtime.refreshTokens(tokens),
    };
}
