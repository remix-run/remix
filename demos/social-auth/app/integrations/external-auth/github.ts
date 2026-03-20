import type { GitHubAuthProfile, OAuthProvider } from 'remix/auth'
import type { RequestContext } from 'remix/fetch-router'
import { createGitHubAuthProvider } from 'remix/auth'

import { routes } from '../../routes.ts'
import { getDemoOrigin, readProviderCredentials } from './provider-config.ts'

export function createGitHubProvider(
  context: RequestContext,
): OAuthProvider<GitHubAuthProfile, 'github'> | null {
  let credentials = readProviderCredentials('GITHUB')
  if (credentials == null) {
    return null
  }

  return createGitHubAuthProvider({
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    redirectUri: new URL(routes.auth.github.callback.href(), getDemoOrigin(context.url)),
  })
}
