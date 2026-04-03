import * as fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  createAtmosphereAuthProvider,
  createGitHubAuthProvider,
  createGoogleAuthProvider,
  createXAuthProvider,
} from 'remix/auth'
import type {
  AtmosphereAuthProfile,
  AtmosphereAuthProviderOptions,
  GitHubAuthProfile,
  GoogleAuthProfile,
  OAuthProvider,
  XAuthProfile,
} from 'remix/auth'
import type { FileStorage } from 'remix/file-storage'
import { createFsFileStorage } from 'remix/file-storage/fs'
import { createMemoryFileStorage } from 'remix/file-storage/memory'

import { routes } from '../routes.ts'

export type ExternalProviderName = 'google' | 'github' | 'x' | 'atmosphere'
export type ButtonProviderName = 'google' | 'github' | 'x'

export type AtmosphereProviderConfiguration = AtmosphereAuthProviderOptions<AtmosphereAuthProfile>

type ExternalProviderFor<name extends ExternalProviderName> = name extends 'google'
  ? OAuthProvider<GoogleAuthProfile, 'google'>
  : name extends 'github'
    ? OAuthProvider<GitHubAuthProfile, 'github'>
    : name extends 'x'
      ? OAuthProvider<XAuthProfile, 'x'>
      : AtmosphereProviderConfiguration

export interface ExternalProviderRegistry {
  google: ExternalProviderFor<'google'> | null
  github: ExternalProviderFor<'github'> | null
  x: ExternalProviderFor<'x'> | null
  atmosphere: ExternalProviderFor<'atmosphere'>
}

type ProviderEnvPrefix = 'GOOGLE' | 'GITHUB' | 'X'
type ExternalProviderEnvironment = Record<string, string | undefined>

interface ProviderCredentials {
  clientId: string
  clientSecret: string
}

export interface ExternalProviderLink {
  name: ButtonProviderName
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
  atmosphere: 'Atmosphere',
} satisfies Record<ExternalProviderName, string>

const providerEnvPrefixes = {
  google: 'GOOGLE',
  github: 'GITHUB',
  x: 'X',
} satisfies Record<ButtonProviderName, ProviderEnvPrefix>

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
    atmosphere: createAtmosphereConfiguration(),
  }
}

/**
 * Creates an Atmosphere provider for a handle or DID entered by the current user.
 *
 * The social-auth demo uses the localhost client-id workflow so it can run locally
 * without additional Atmosphere-specific environment variables.
 *
 * @param handleOrDid The Bluesky handle or DID submitted by the user.
 * @param registry Provider configuration registry for the demo.
 * @returns An initialized Atmosphere provider for the requested account identifier.
 */
export function createAtmosphereProvider(
  handleOrDid: string,
  registry: ExternalProviderRegistry = externalProviderRegistry,
) {
  return createAtmosphereAuthProvider(handleOrDid, registry.atmosphere)
}

export function getExternalProviderLabel(name: ExternalProviderName): string {
  return providerLabels[name]
}

export function getExternalProviderStatus(
  name: ButtonProviderName,
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

function createAtmosphereConfiguration(): AtmosphereProviderConfiguration {
  return {
    clientId: 'http://localhost',
    redirectUri: new URL(routes.auth.atmosphere.callback.href(), getDemoOrigin()),
    fileStorage: createAtmosphereFileStorage(),
    scopes: ['atproto'],
  }
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

function createAtmosphereFileStorage(): FileStorage {
  if (process.env.NODE_ENV === 'test') {
    return createMemoryFileStorage()
  }

  let directoryPath = fileURLToPath(new URL('../../tmp/atmosphere/', import.meta.url))
  fs.mkdirSync(directoryPath, { recursive: true })
  return createFsFileStorage(directoryPath)
}
