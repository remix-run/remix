import { createGitHubAuthProvider, createGoogleAuthProvider, createXAuthProvider } from 'remix/auth'
import type { GitHubAuthProfile, GoogleAuthProfile, OAuthProvider, XAuthProfile } from 'remix/auth'

import { routes } from '../routes.ts'

export type ExternalProviderName = 'google' | 'github' | 'x'

type ExternalProviderFor<name extends ExternalProviderName> = name extends 'google'
  ? OAuthProvider<GoogleAuthProfile, 'google'>
  : name extends 'github'
    ? OAuthProvider<GitHubAuthProfile, 'github'>
    : OAuthProvider<XAuthProfile, 'x'>

export interface ExternalProviderRegistry {
  google: ExternalProviderFor<'google'> | null
  github: ExternalProviderFor<'github'> | null
  x: ExternalProviderFor<'x'> | null
}

type ProviderEnvPrefix = 'GOOGLE' | 'GITHUB' | 'X'
type ExternalProviderEnvironment = Record<string, string | undefined>

interface ProviderCredentials {
  clientId: string
  clientSecret: string
}

export interface ExternalProviderLink {
  name: ExternalProviderName
  href?: string
  disabledReason?: string
}

interface ProviderStatus {
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

export const externalProviderRegistry = createExternalProviderRegistry()

export function createExternalProviderRegistry(
  options: {
    env?: ExternalProviderEnvironment
    origin?: string | URL
  } = {},
): ExternalProviderRegistry {
  let env = options.env ?? process.env
  let origin = options.origin ?? getDemoOrigin()

  return {
    google: createGoogleProvider(origin, env),
    github: createGitHubProvider(origin, env),
    x: createXProvider(origin, env),
  }
}

export function getExternalProviderLabel(name: ExternalProviderName): string {
  return providerLabels[name]
}

export function getExternalProviderStatus(
  name: ExternalProviderName,
  registry: ExternalProviderRegistry = externalProviderRegistry,
  env: ExternalProviderEnvironment = process.env,
): ProviderStatus {
  return {
    enabled: registry[name] != null,
    missingEnvVars: readMissingProviderEnvVars(providerEnvPrefixes[name], env),
  }
}

export function readExternalProviderLinks(
  returnToQuery: { returnTo?: string },
  registry: ExternalProviderRegistry = externalProviderRegistry,
  env: ExternalProviderEnvironment = process.env,
): ExternalProviderLink[] {
  return externalProviderNames.map((name) => {
    let status = getExternalProviderStatus(name, registry, env)

    return {
      name,
      href: status.enabled ? routes.auth[name].login.href(undefined, returnToQuery) : undefined,
      disabledReason: status.enabled ? undefined : createDisabledReason(name, status),
    }
  })
}

export function getDemoOrigin(port = process.env.PORT ?? '44100'): string {
  return `http://127.0.0.1:${port}`
}

function createGoogleProvider(
  origin: string | URL,
  env: ExternalProviderEnvironment,
): ExternalProviderFor<'google'> | null {
  let credentials = readProviderCredentials('GOOGLE', env)
  if (credentials == null) {
    return null
  }

  return createGoogleAuthProvider({
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    redirectUri: new URL(routes.auth.google.callback.href(), toOriginString(origin)),
  })
}

function createGitHubProvider(
  origin: string | URL,
  env: ExternalProviderEnvironment,
): ExternalProviderFor<'github'> | null {
  let credentials = readProviderCredentials('GITHUB', env)
  if (credentials == null) {
    return null
  }

  return createGitHubAuthProvider({
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    redirectUri: new URL(routes.auth.github.callback.href(), toOriginString(origin)),
  })
}

function createXProvider(
  origin: string | URL,
  env: ExternalProviderEnvironment,
): ExternalProviderFor<'x'> | null {
  let credentials = readProviderCredentials('X', env)
  if (credentials == null) {
    return null
  }

  return createXAuthProvider({
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    redirectUri: new URL(routes.auth.x.callback.href(), toOriginString(origin)),
  })
}

function createDisabledReason(name: ExternalProviderName, status: ProviderStatus): string {
  if (status.missingEnvVars.length === 0) {
    return `${getExternalProviderLabel(name)} login is not configured.`
  }

  return `Set ${status.missingEnvVars.join(' and ')} to enable ${getExternalProviderLabel(name)} login.`
}

function readMissingProviderEnvVars(
  prefix: ProviderEnvPrefix,
  env: ExternalProviderEnvironment,
): string[] {
  let missingEnvVars = []

  if (!env[`${prefix}_CLIENT_ID`]) {
    missingEnvVars.push(`${prefix}_CLIENT_ID`)
  }

  if (!env[`${prefix}_CLIENT_SECRET`]) {
    missingEnvVars.push(`${prefix}_CLIENT_SECRET`)
  }

  return missingEnvVars
}

function readProviderCredentials(
  prefix: ProviderEnvPrefix,
  env: ExternalProviderEnvironment,
): ProviderCredentials | null {
  let clientId = env[`${prefix}_CLIENT_ID`]
  let clientSecret = env[`${prefix}_CLIENT_SECRET`]

  if (!clientId || !clientSecret) {
    return null
  }

  return { clientId, clientSecret }
}

function toOriginString(origin: string | URL): string {
  return typeof origin === 'string' ? origin : origin.toString()
}
