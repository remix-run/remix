import { getOAuthProviderRuntime } from './provider.ts'
import type { OAuthProvider, OAuthTokens } from './provider.ts'

/**
 * Completed result returned from a successful refresh-token exchange.
 */
export interface RefreshedExternalAuthResult<provider extends string = string> {
  /** Provider name whose token bundle was refreshed. */
  provider: provider
  /** Updated token bundle returned by the provider runtime. */
  tokens: OAuthTokens
}

/**
 * Refreshes an OAuth or OIDC token bundle with the provider's refresh-token flow.
 *
 * @param provider The external provider that issued the original token bundle.
 * @param tokens The current provider token bundle, including a refresh token when available.
 * @returns The provider name plus the refreshed token bundle.
 */
export async function refreshExternalAuth<profile = never, provider extends string = string>(
  provider: OAuthProvider<profile, provider>,
  tokens: OAuthTokens,
): Promise<RefreshedExternalAuthResult<provider>> {
  let runtime = getOAuthProviderRuntime(provider)

  if (runtime.refreshTokens == null) {
    throw new Error(`OAuth provider "${provider.name}" does not support refresh-token exchange.`)
  }

  return {
    provider: provider.name,
    tokens: await runtime.refreshTokens(tokens),
  }
}
