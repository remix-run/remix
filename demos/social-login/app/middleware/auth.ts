import { createFacebookAuthProvider, createGitHubAuthProvider, createGoogleAuthProvider } from 'remix/auth'
import type {
  FacebookProfile,
  GitHubProfile,
  GoogleProfile,
  OAuthProvider,
  OAuthResult,
} from 'remix/auth'
import { auth, sessionAuth } from 'remix/auth-middleware'
import type { Middleware } from 'remix/fetch-router'

import type { SocialLoginConfig } from '../config.ts'
import type { Session } from '../utils/session.ts'

export type SocialProviderName = 'google' | 'github' | 'facebook'

export interface SocialUser {
  provider: SocialProviderName
  providerAccountId: string
  name: string | null
  email: string | null
  avatarUrl: string | null
}

export interface SocialProviderState {
  name: SocialProviderName
  label: string
  configured: boolean
  missingEnv: string[]
}

type SocialProvider =
  | OAuthProvider<GoogleProfile, 'google'>
  | OAuthProvider<GitHubProfile, 'github'>
  | OAuthProvider<FacebookProfile, 'facebook'>

type SocialAuthResult =
  | OAuthResult<GoogleProfile, 'google'>
  | OAuthResult<GitHubProfile, 'github'>
  | OAuthResult<FacebookProfile, 'facebook'>

export function loadAuth(): Middleware {
  return auth({
    schemes: [
      sessionAuth<SocialUser, SocialUser>({
        read(session) {
          return parseSocialUser(session.get('auth'))
        },
        verify(value) {
          return value
        },
        invalidate(session) {
          clearAuthenticatedSession(session)
        },
      }),
    ],
  })
}

export function getSocialProviderStates(config: SocialLoginConfig): SocialProviderState[] {
  return [
    createProviderState('google', config),
    createProviderState('github', config),
    createProviderState('facebook', config),
  ]
}

export function getProviderLabel(name: SocialProviderName): string {
  switch (name) {
    case 'google':
      return 'Google'
    case 'github':
      return 'GitHub'
    case 'facebook':
      return 'Facebook'
  }
}

export function getProviderUnavailableMessage(
  name: SocialProviderName,
  config: SocialLoginConfig,
): string {
  let missingEnv = getMissingProviderEnv(name, config)

  if (missingEnv.length === 0) {
    return `${getProviderLabel(name)} login is not configured.`
  }

  return `${getProviderLabel(name)} login is not configured. Set ${missingEnv.join(' and ')}.`
}

export function createSocialAuthProvider(
  name: SocialProviderName,
  origin: string,
  config: SocialLoginConfig,
): SocialProvider | null {
  switch (name) {
    case 'google':
      return createGoogleProvider(origin, config)
    case 'github':
      return createGitHubProvider(origin, config)
    case 'facebook':
      return createFacebookProvider(origin, config)
  }
}

export function createGoogleProvider(
  origin: string,
  config: SocialLoginConfig,
): OAuthProvider<GoogleProfile, 'google'> | null {
  if (!config.googleClientId || !config.googleClientSecret) {
    return null
  }

  return createGoogleAuthProvider({
    clientId: config.googleClientId,
    clientSecret: config.googleClientSecret,
    redirectUri: new URL('/auth/google/callback', origin),
  })
}

export function createGitHubProvider(
  origin: string,
  config: SocialLoginConfig,
): OAuthProvider<GitHubProfile, 'github'> | null {
  if (!config.githubClientId || !config.githubClientSecret) {
    return null
  }

  return createGitHubAuthProvider({
    clientId: config.githubClientId,
    clientSecret: config.githubClientSecret,
    redirectUri: new URL('/auth/github/callback', origin),
  })
}

export function createFacebookProvider(
  origin: string,
  config: SocialLoginConfig,
): OAuthProvider<FacebookProfile, 'facebook'> | null {
  if (!config.facebookClientId || !config.facebookClientSecret) {
    return null
  }

  return createFacebookAuthProvider({
    clientId: config.facebookClientId,
    clientSecret: config.facebookClientSecret,
    redirectUri: new URL('/auth/facebook/callback', origin),
  })
}

export function createAuthenticatedUser(result: SocialAuthResult): SocialUser {
  switch (result.provider) {
    case 'google':
      return {
        provider: 'google',
        providerAccountId: result.account.providerAccountId,
        name: result.profile.name ?? null,
        email: result.profile.email ?? null,
        avatarUrl: result.profile.picture ?? null,
      }
    case 'github':
      return {
        provider: 'github',
        providerAccountId: result.account.providerAccountId,
        name: result.profile.name ?? result.profile.login ?? null,
        email: result.profile.email ?? null,
        avatarUrl: result.profile.avatar_url ?? null,
      }
    case 'facebook':
      return {
        provider: 'facebook',
        providerAccountId: result.account.providerAccountId,
        name: result.profile.name ?? null,
        email: result.profile.email ?? null,
        avatarUrl: result.profile.picture?.data?.url ?? null,
      }
  }
}

export function writeAuthenticatedSession(session: Session, user: SocialUser): void {
  session.set('auth', user)
}

export function clearAuthenticatedSession(session: Session): void {
  session.unset('auth')
}

function createProviderState(name: SocialProviderName, config: SocialLoginConfig): SocialProviderState {
  let missingEnv = getMissingProviderEnv(name, config)

  return {
    name,
    label: getProviderLabel(name),
    configured: missingEnv.length === 0,
    missingEnv,
  }
}

function getMissingProviderEnv(name: SocialProviderName, config: SocialLoginConfig): string[] {
  switch (name) {
    case 'google':
      return getMissingValues([
        ['GOOGLE_CLIENT_ID', config.googleClientId],
        ['GOOGLE_CLIENT_SECRET', config.googleClientSecret],
      ])
    case 'github':
      return getMissingValues([
        ['GITHUB_CLIENT_ID', config.githubClientId],
        ['GITHUB_CLIENT_SECRET', config.githubClientSecret],
      ])
    case 'facebook':
      return getMissingValues([
        ['FACEBOOK_CLIENT_ID', config.facebookClientId],
        ['FACEBOOK_CLIENT_SECRET', config.facebookClientSecret],
      ])
  }

  return []
}

function getMissingValues(entries: [string, string | undefined][]): string[] {
  return entries.flatMap(([name, value]) => (value ? [] : [name]))
}

function parseSocialUser(value: unknown): SocialUser | null {
  if (typeof value !== 'object' || value == null) {
    return null
  }

  let provider = readProvider((value as { provider?: unknown }).provider)
  let providerAccountId = readString((value as { providerAccountId?: unknown }).providerAccountId)

  if (provider == null || providerAccountId == null) {
    return null
  }

  return {
    provider,
    providerAccountId,
    name: readNullableString((value as { name?: unknown }).name),
    email: readNullableString((value as { email?: unknown }).email),
    avatarUrl: readNullableString((value as { avatarUrl?: unknown }).avatarUrl),
  }
}

function readProvider(value: unknown): SocialProviderName | null {
  switch (value) {
    case 'google':
    case 'github':
    case 'facebook':
      return value
    default:
      return null
  }
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') {
    return null
  }

  return value
}

function readNullableString(value: unknown): string | null {
  if (value == null) {
    return null
  }

  return typeof value === 'string' && value !== '' ? value : null
}
