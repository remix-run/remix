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

type ProviderEnvPrefix = 'GOOGLE' | 'GITHUB' | 'X'

interface ProviderCredentials {
  clientId: string
  clientSecret: string
}

export interface ProviderAvailability {
  google: boolean
  github: boolean
  x: boolean
}

export interface ProviderStatus {
  enabled: boolean
  missingEnvVars: string[]
}

export interface ProviderStatuses {
  google: ProviderStatus
  github: ProviderStatus
  x: ProviderStatus
}

export function getProviderAvailability(): ProviderAvailability {
  let statuses = getProviderStatuses()

  return {
    google: statuses.google.enabled,
    github: statuses.github.enabled,
    x: statuses.x.enabled,
  }
}

export function getProviderStatuses(): ProviderStatuses {
  return {
    google: getProviderStatus('GOOGLE'),
    github: getProviderStatus('GITHUB'),
    x: getProviderStatus('X'),
  }
}

export function getDemoOrigin(url?: URL): string {
  let port = url?.port || process.env.PORT || '44100'
  return `http://127.0.0.1:${port}`
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
    redirectUri: new URL(routes.auth.google.callback.href(), getDemoOrigin(context.url)),
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
    redirectUri: new URL(routes.auth.github.callback.href(), getDemoOrigin(context.url)),
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
    redirectUri: new URL(routes.auth.x.callback.href(), getDemoOrigin(context.url)),
  })
}

function getProviderStatus(prefix: ProviderEnvPrefix): ProviderStatus {
  let missingEnvVars = getMissingProviderEnvVars(prefix)

  return {
    enabled: missingEnvVars.length === 0,
    missingEnvVars,
  }
}

function getMissingProviderEnvVars(prefix: ProviderEnvPrefix): string[] {
  let missingEnvVars = []

  if (!process.env[`${prefix}_CLIENT_ID`]) {
    missingEnvVars.push(`${prefix}_CLIENT_ID`)
  }

  if (!process.env[`${prefix}_CLIENT_SECRET`]) {
    missingEnvVars.push(`${prefix}_CLIENT_SECRET`)
  }

  return missingEnvVars
}

function readProviderCredentials(prefix: ProviderEnvPrefix): ProviderCredentials | null {
  let clientId = process.env[`${prefix}_CLIENT_ID`]
  let clientSecret = process.env[`${prefix}_CLIENT_SECRET`]

  if (!clientId || !clientSecret) {
    return null
  }

  return { clientId, clientSecret }
}
