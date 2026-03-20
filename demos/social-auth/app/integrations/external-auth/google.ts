import type { GoogleAuthProfile, OAuthProvider } from 'remix/auth'
import type { RequestContext } from 'remix/fetch-router'
import { createGoogleAuthProvider } from 'remix/auth'

import { routes } from '../../routes.ts'
import { getDemoOrigin, readProviderCredentials } from './provider-config.ts'

export function createGoogleProvider(
  context: RequestContext,
): OAuthProvider<GoogleAuthProfile, 'google'> | null {
  let credentials = readProviderCredentials('GOOGLE')
  if (credentials == null) {
    return null
  }

  return createGoogleAuthProvider({
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    redirectUri: new URL(routes.auth.google.callback.href(), getDemoOrigin(context.url)),
  })
}
