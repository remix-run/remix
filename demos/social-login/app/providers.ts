import type {
  GitHubAuthProfile,
  GoogleAuthProfile,
  OAuthProvider,
  XAuthProfile,
} from 'remix/auth'
import type { RequestContext } from 'remix/fetch-router'
import {
  createGitHubAuthProvider,
  createGoogleAuthProvider,
  createXAuthProvider,
} from 'remix/auth'

import { routes } from './routes.ts'

export type ExternalProviderName = 'google' | 'github' | 'x'

interface ProviderCredentials {
  clientId: string
  clientSecret: string
}

export interface ProviderAvailability {
  google: boolean
  github: boolean
  x: boolean
}

export function getProviderAvailability(): ProviderAvailability {
  return {
    google: readProviderCredentials('GOOGLE') != null,
    github: readProviderCredentials('GITHUB') != null,
    x: readProviderCredentials('X') != null,
  }
}

export function createGoogleProvider(
  context: RequestContext,
): OAuthProvider<GoogleAuthProfile, 'google'> | null {
  let credentials = readProviderCredentials('GOOGLE')
  if (!credentials) {
    return null
  }

  return createGoogleAuthProvider({
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    redirectUri: new URL(routes.auth.google.callback.href(), context.url.origin),
  })
}

export function createGitHubProvider(
  context: RequestContext,
): OAuthProvider<GitHubAuthProfile, 'github'> | null {
  let credentials = readProviderCredentials('GITHUB')
  if (!credentials) {
    return null
  }

  return createGitHubAuthProvider({
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    redirectUri: new URL(routes.auth.github.callback.href(), context.url.origin),
  })
}

export function createXProvider(context: RequestContext): OAuthProvider<XAuthProfile, 'x'> | null {
  let credentials = readProviderCredentials('X')
  if (!credentials) {
    return null
  }

  return createXAuthProvider({
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    redirectUri: new URL(routes.auth.x.callback.href(), context.url.origin),
  })
}

function readProviderCredentials(prefix: 'GOOGLE' | 'GITHUB' | 'X'): ProviderCredentials | null {
  let clientId = process.env[`${prefix}_CLIENT_ID`]
  let clientSecret = process.env[`${prefix}_CLIENT_SECRET`]

  if (!clientId || !clientSecret) {
    return null
  }

  return { clientId, clientSecret }
}
