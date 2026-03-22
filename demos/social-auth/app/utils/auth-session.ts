import * as s from 'remix/data-schema'

import type { AuthAccount, User } from '../data/schema.ts'
import type { ExternalProviderName } from './external-auth.ts'

export type AuthMethod = 'credentials' | ExternalProviderName

export interface AuthSession {
  userId: number
  loginMethod: AuthMethod
  authAccountId?: number
}

export interface AuthIdentity {
  user: User
  loginMethod: AuthMethod
  authAccount: AuthAccount | null
  providerProfile: unknown | null
}

let authSessionSchema = s.object({
  userId: s.number().refine(Number.isInteger, 'Expected an integer userId'),
  loginMethod: s.union([
    s.literal('credentials'),
    s.literal('google'),
    s.literal('github'),
    s.literal('x'),
  ]),
  authAccountId: s.optional(
    s.number().refine(Number.isInteger, 'Expected an integer authAccountId'),
  ),
})

export function parseAuthSession(value: unknown): AuthSession | null {
  let result = s.parseSafe(authSessionSchema, value)
  if (result.success === false || isAuthMethod(result.value.loginMethod) === false) {
    return null
  }

  let authSession: AuthSession = {
    userId: result.value.userId,
    loginMethod: result.value.loginMethod,
  }

  if (result.value.authAccountId !== undefined) {
    authSession.authAccountId = result.value.authAccountId
  }

  return authSession
}

export function parseProviderProfile(authAccount: AuthAccount | null): unknown | null {
  if (authAccount == null) {
    return null
  }

  try {
    return JSON.parse(authAccount.profile_json)
  } catch {
    return null
  }
}

function isAuthMethod(value: string): value is AuthMethod {
  return value === 'credentials' || value === 'google' || value === 'github' || value === 'x'
}
