import { createCredentialsAuthProvider } from 'remix/auth'
import { auth, createSessionAuthScheme } from 'remix/auth-middleware'
import type { Middleware } from 'remix/fetch-router'
import type { Database as DataTableDatabase } from 'remix/data-table'

import { authAccounts, users, type User } from '../data/schema.ts'
import type { LoginMethod, SocialAuthResult } from '../social-providers.ts'
import type { Session } from '../utils/session.ts'
import { AppDatabase } from './database.ts'

export interface AuthenticatedUser {
  id: number
  email: string | null
  name: string | null
  avatarUrl: string | null
  loginMethod: LoginMethod
}

interface SocialLoginSession {
  userId: number
  loginMethod: LoginMethod
}

interface SocialProfileData {
  email?: string
  name?: string
  avatarUrl?: string
}

type SocialProfilePatch = Pick<Partial<User>, 'email' | 'name' | 'avatar_url'>

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
      createSessionAuthScheme<AuthenticatedUser, SocialLoginSession>({
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

export async function upsertSocialUser(
  db: DataTableDatabase,
  result: SocialAuthResult,
): Promise<User> {
  let now = Date.now()
  let profile = getSocialProfileData(result)
  let profilePatch = createSocialProfilePatch(profile)

  return db.transaction(async (tx) => {
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
        ...profilePatch,
        updated_at: now,
      })

      await tx.update(authAccounts, account.id, {
        ...profilePatch,
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
              ...profilePatch,
              created_at: now,
              updated_at: now,
            },
            { returnRow: true },
          )
        : await tx.update(users, existingUser.id, {
            ...profilePatch,
            updated_at: now,
          })

    await tx.create(authAccounts, {
      user_id: user.id,
      provider: result.provider,
      provider_account_id: result.account.providerAccountId,
      ...profilePatch,
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

function createSocialProfilePatch(profile: SocialProfileData): SocialProfilePatch {
  let next: SocialProfilePatch = {}

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
    case 'x':
      return {
        name: normalizeOptionalString(result.profile.name ?? result.profile.username),
        avatarUrl: normalizeOptionalString(result.profile.profile_image_url),
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
    case 'x':
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
