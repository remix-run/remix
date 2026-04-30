import { getOAuthProviderRuntime } from './provider.ts'
import type { OAuthProvider, OAuthTokens } from './provider.ts'

type NoInferValue<value> = [value][value extends unknown ? 0 : never]

/**
 * Completed result returned from a successful refresh-token exchange.
 */
export interface RefreshedExternalAuthResult<
  provider extends string = string,
  tokens extends OAuthTokens = OAuthTokens,
> {
  /** Provider name whose token bundle was refreshed. */
  provider: provider
  /** Updated token bundle returned by the provider runtime. */
  tokens: tokens
}

/**
 * Refreshes an OAuth or OIDC token bundle with the provider's refresh-token flow.
 *
 * @param provider The external provider that issued the original token bundle.
 * @param tokens The current provider token bundle, including a refresh token when available.
 * @returns The provider name plus the refreshed token bundle.
 */
export async function refreshExternalAuth<
  profile = never,
  provider extends string = string,
  tokens extends OAuthTokens = OAuthTokens,
>(
  provider: OAuthProvider<profile, provider, tokens>,
  tokens: NoInferValue<tokens>,
): Promise<RefreshedExternalAuthResult<provider, tokens>> {
  let runtime = getOAuthProviderRuntime(provider)

  if (runtime.refreshTokens == null) {
    throw new Error(`OAuth provider "${provider.name}" does not support refresh-token exchange.`)
  }

  return {
    provider: provider.name,
    tokens: await runtime.refreshTokens(tokens),
  }
}
