import type { OAuthProvider, XAuthProfile } from 'remix/auth'
import type { RequestContext } from 'remix/fetch-router'
import { createXAuthProvider } from 'remix/auth'

import { routes } from '../../routes.ts'
import { getDemoOrigin, readProviderCredentials } from './provider-config.ts'

export function createXProvider(context: RequestContext): OAuthProvider<XAuthProfile, 'x'> | null {
  let credentials = readProviderCredentials('X')
  if (credentials == null) {
    return null
  }

  return createXAuthProvider({
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    redirectUri: new URL(routes.auth.x.callback.href(), getDemoOrigin(context.url)),
  })
}
