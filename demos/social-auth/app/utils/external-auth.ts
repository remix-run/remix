import { createGitHubAuthProvider, createGoogleAuthProvider, createXAuthProvider } from 'remix/auth'
import type { GitHubAuthProfile, GoogleAuthProfile, OAuthProvider, XAuthProfile } from 'remix/auth'
import type { RequestContext, ContextEntries } from 'remix/fetch-router'

import { routes } from '../routes.ts'

export type ExternalProviderName = 'google' | 'github' | 'x'

export type ExternalProviderFor<name extends ExternalProviderName> = name extends 'google'
  ? OAuthProvider<GoogleAuthProfile, 'google'>
  : name extends 'github'
    ? OAuthProvider<GitHubAuthProfile, 'github'>
    : OAuthProvider<XAuthProfile, 'x'>

type ProviderEnvPrefix = 'GOOGLE' | 'GITHUB' | 'X'

interface ProviderCredentials {
  clientId: string
  clientSecret: string
}

export interface ExternalProviderLink {
  name: ExternalProviderName
  href?: string
  disabledReason?: string
}

export interface ProviderStatus {
  enabled: boolean
  missingEnvVars: string[]
}

const providerLabels = {
  google: 'Google',
  github: 'GitHub',
  x: 'X',
} satisfies Record<ExternalProviderName, string>

const providerEnvPrefixes = {
  google: 'GOOGLE',
  github: 'GITHUB',
  x: 'X',
} satisfies Record<ExternalProviderName, ProviderEnvPrefix>

export const externalProviderNames = ['google', 'github', 'x'] as const

export function createExternalProvider<
  params extends Record<string, string>,
  entries extends ContextEntries,
  name extends ExternalProviderName,
>(name: name, context: RequestContext<params, entries>): ExternalProviderFor<name> | null {
  switch (name) {
    case 'google':
      return createGoogleProvider(context) as ExternalProviderFor<name> | null
    case 'github':
      return createGitHubProvider(context) as ExternalProviderFor<name> | null
    case 'x':
      return createXProvider(context) as ExternalProviderFor<name> | null
  }
}

export function getExternalProviderLabel(name: ExternalProviderName): string {
  return providerLabels[name]
}

export function getExternalProviderStatus(name: ExternalProviderName): ProviderStatus {
  let missingEnvVars = readMissingProviderEnvVars(providerEnvPrefixes[name])

  return {
    enabled: missingEnvVars.length === 0,
    missingEnvVars,
  }
}

export function readExternalProviderLinks(returnToQuery: {
  returnTo?: string
}): ExternalProviderLink[] {
  return externalProviderNames.map((name) => {
    let status = getExternalProviderStatus(name)

    return {
      name,
      href: status.enabled ? routes.auth[name].login.href(undefined, returnToQuery) : undefined,
      disabledReason: status.enabled ? undefined : createDisabledReason(name, status),
    }
  })
}

export function getDemoOrigin(url?: URL): string {
  let port = url?.port || process.env.PORT || '44100'
  return `http://127.0.0.1:${port}`
}

function createGoogleProvider<
  params extends Record<string, string>,
  entries extends ContextEntries,
>(context: RequestContext<params, entries>): OAuthProvider<GoogleAuthProfile, 'google'> | null {
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

function createGitHubProvider<
  params extends Record<string, string>,
  entries extends ContextEntries,
>(context: RequestContext<params, entries>): OAuthProvider<GitHubAuthProfile, 'github'> | null {
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

function createXProvider<params extends Record<string, string>, entries extends ContextEntries>(
  context: RequestContext<params, entries>,
): OAuthProvider<XAuthProfile, 'x'> | null {
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

function createDisabledReason(name: ExternalProviderName, status: ProviderStatus): string {
  return `Set ${status.missingEnvVars.join(' and ')} to enable ${getExternalProviderLabel(name)} login.`
}

function readMissingProviderEnvVars(prefix: ProviderEnvPrefix): string[] {
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
