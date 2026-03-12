import { createCredentialsAuthProvider } from 'remix/auth'
import {
  createFacebookAuthProvider,
  createGitHubAuthProvider,
  createGoogleAuthProvider,
} from 'remix/auth'
import type {
  FacebookProfile,
  GitHubProfile,
  GoogleProfile,
  OAuthProvider,
  OAuthResult,
} from 'remix/auth'
import { auth, sessionAuth } from 'remix/auth-middleware'
import type { Middleware } from 'remix/fetch-router'
import type { Database as DataTableDatabase } from 'remix/data-table'

import type { SocialLoginConfig } from '../config.ts'
import { authAccounts, users, type User } from '../data/schema.ts'
import { routes } from '../routes.ts'
import type { Session } from '../utils/session.ts'
import { AppDatabase } from './database.ts'

export type SocialProviderName = 'google' | 'github' | 'facebook'
export type LoginMethod = SocialProviderName | 'password'

export interface AuthenticatedUser {
  id: number
  email: string | null
  name: string | null
  avatarUrl: string | null
  loginMethod: LoginMethod
}

export interface SocialProviderState {
  name: SocialProviderName
  label: string
  configured: boolean
  missingEnv: string[]
}

interface SocialLoginSession {
  userId: number
  loginMethod: LoginMethod
}

type SocialProvider =
  | OAuthProvider<GoogleProfile, 'google'>
  | OAuthProvider<GitHubProfile, 'github'>
  | OAuthProvider<FacebookProfile, 'facebook'>

export type SocialAuthResult =
  | OAuthResult<GoogleProfile, 'google'>
  | OAuthResult<GitHubProfile, 'github'>
  | OAuthResult<FacebookProfile, 'facebook'>

interface SocialProfileData {
  email?: string
  name?: string
  avatarUrl?: string
}

export let passwordProvider = createCredentialsAuthProvider({
  parse(context) {
    let formData = context.get(FormData)

    return {
      email: normalizeEmail(formData.get('email')?.toString() ?? ''),
      password: formData.get('password')?.toString() ?? '',
    }
  },
  async verify({ email, password }, context) {
    let db = context.get(AppDatabase)
    let user = email === '' ? null : await db.findOne(users, { where: { email } })

    if (!user || user.password !== password) {
      return null
    }

    return user
  },
})

export function loadAuth(): Middleware {
  return auth({
    schemes: [
      sessionAuth<AuthenticatedUser, SocialLoginSession>({
        read(session) {
          return parseSocialLoginSession(session.get('auth'))
        },
        async verify(value, context) {
          let user = await context.get(AppDatabase).find(users, value.userId)

          if (user == null) {
            return null
          }

          return toAuthenticatedUser(user, value.loginMethod)
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

export function getLoginMethodLabel(method: LoginMethod): string {
  if (method === 'password') {
    return 'Email and password'
  }

  return getProviderLabel(method)
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
    redirectUri: new URL(routes.auth.google.callback.href(), origin),
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
    redirectUri: new URL(routes.auth.github.callback.href(), origin),
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
    redirectUri: new URL(routes.auth.facebook.callback.href(), origin),
  })
}

export async function upsertSocialUser(
  db: DataTableDatabase,
  result: SocialAuthResult,
): Promise<User> {
  let now = Date.now()
  let profile = getSocialProfileData(result)

  return db.transaction(async tx => {
    let account = await tx.findOne(authAccounts, {
      where: {
        provider: result.provider,
        provider_account_id: result.account.providerAccountId,
      },
    })

    if (account != null) {
      let user = await tx.find(users, account.user_id)

      if (user == null) {
        throw new Error('Linked social account is missing its user record.')
      }

      let nextUser = await tx.update(users, user.id, {
        ...createUserPatch(profile),
        updated_at: now,
      })

      await tx.update(authAccounts, account.id, {
        ...createAuthAccountPatch(profile),
        updated_at: now,
      })

      return nextUser
    }

    let existingUser =
      profile.email == null ? null : await tx.findOne(users, { where: { email: profile.email } })

    let user =
      existingUser == null
        ? await tx.create(
            users,
            {
              ...createUserPatch(profile),
              created_at: now,
              updated_at: now,
            },
            { returnRow: true },
          )
        : await tx.update(users, existingUser.id, {
            ...createUserPatch(profile),
            updated_at: now,
          })

    await tx.create(authAccounts, {
      user_id: user.id,
      provider: result.provider,
      provider_account_id: result.account.providerAccountId,
      ...createAuthAccountPatch(profile),
      created_at: now,
      updated_at: now,
    })

    return user
  })
}

export function writeAuthenticatedSession(
  session: Session,
  user: Pick<User, 'id'>,
  loginMethod: LoginMethod,
): void {
  session.set('auth', {
    userId: user.id,
    loginMethod,
  })
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

function createUserPatch(profile: SocialProfileData): Partial<User> {
  let next: Partial<User> = {}

  if (profile.email !== undefined) {
    next.email = profile.email
  }

  if (profile.name !== undefined) {
    next.name = profile.name
  }

  if (profile.avatarUrl !== undefined) {
    next.avatar_url = profile.avatarUrl
  }

  return next
}

function createAuthAccountPatch(profile: SocialProfileData) {
  let next: Record<string, string> = {}

  if (profile.email !== undefined) {
    next.email = profile.email
  }

  if (profile.name !== undefined) {
    next.name = profile.name
  }

  if (profile.avatarUrl !== undefined) {
    next.avatar_url = profile.avatarUrl
  }

  return next
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
}

function getMissingValues(entries: [string, string | undefined][]): string[] {
  return entries.flatMap(([name, value]) => (value ? [] : [name]))
}

function getSocialProfileData(result: SocialAuthResult): SocialProfileData {
  switch (result.provider) {
    case 'google':
      return {
        email: normalizeOptionalString(result.profile.email),
        name: normalizeOptionalString(result.profile.name),
        avatarUrl: normalizeOptionalString(result.profile.picture),
      }
    case 'github':
      return {
        email: normalizeOptionalString(result.profile.email),
        name: normalizeOptionalString(result.profile.name ?? result.profile.login),
        avatarUrl: normalizeOptionalString(result.profile.avatar_url),
      }
    case 'facebook':
      return {
        email: normalizeOptionalString(result.profile.email),
        name: normalizeOptionalString(result.profile.name),
        avatarUrl: normalizeOptionalString(result.profile.picture?.data?.url),
      }
  }
}

function parseSocialLoginSession(value: unknown): SocialLoginSession | null {
  if (typeof value !== 'object' || value == null) {
    return null
  }

  let userId = readInteger((value as { userId?: unknown }).userId)
  let loginMethod = readLoginMethod((value as { loginMethod?: unknown }).loginMethod)

  if (userId == null || loginMethod == null) {
    return null
  }

  return {
    userId,
    loginMethod,
  }
}

function toAuthenticatedUser(user: User, loginMethod: LoginMethod): AuthenticatedUser {
  return {
    id: user.id,
    email: normalizeOptionalString(user.email) ?? null,
    name: normalizeOptionalString(user.name) ?? null,
    avatarUrl: normalizeOptionalString(user.avatar_url) ?? null,
    loginMethod,
  }
}

function readInteger(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return null
  }

  return value
}

function readLoginMethod(value: unknown): LoginMethod | null {
  switch (value) {
    case 'google':
    case 'github':
    case 'facebook':
    case 'password':
      return value
    default:
      return null
  }
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function normalizeOptionalString(value: string | null | undefined): string | undefined {
  let trimmed = value?.trim()

  return trimmed ? trimmed : undefined
}
