import type { Middleware } from 'remix/fetch-router'
import { createCredentialsAuthProvider } from 'remix/auth'
import { Auth, auth, createSessionAuthScheme, requireAuth as requireAuthenticated } from 'remix/auth-middleware'
import type { GoodAuth } from 'remix/auth-middleware'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { Database } from 'remix/data-table'
import { redirect } from 'remix/response/redirect'

import { authAccounts, normalizeEmail, users } from '../data/schema.ts'
import { routes } from '../routes.ts'
import {
  clearAuthenticatedSession,
  parseProviderProfile,
  parseSocialLoginSession,
  type SocialLoginIdentity,
  type SocialLoginSession,
  writeAuthenticatedSession,
} from '../social-auth.ts'
import { verifyPassword } from '../utils/password.ts'
import type { Session } from '../utils/session.ts'

let loginSchema = f.object({
  email: f.field(s.defaulted(s.string(), '')),
  password: f.field(s.defaulted(s.string(), '')),
})

export function loadAuth(): Middleware {
  return auth({
    schemes: [
      createSessionAuthScheme<SocialLoginIdentity, SocialLoginSession>({
        read(session) {
          return parseSocialLoginSession(session.get('auth'))
        },
        async verify(value, context) {
          let db = context.get(Database)
          let user = await db.find(users, value.userId)
          if (user == null) {
            return null
          }

          let authAccount =
            value.authAccountId != null
              ? await db.find(authAccounts, value.authAccountId)
              : null

          return {
            user,
            loginMethod: value.loginMethod,
            authAccount,
            providerProfile: parseProviderProfile(authAccount),
          }
        },
        invalidate(session) {
          clearAuthenticatedSession(session)
        },
      }),
    ],
  })
}

export let passwordProvider = createCredentialsAuthProvider({
  parse(context) {
    let { email, password } = s.parse(loginSchema, context.get(FormData))

    return {
      email: normalizeEmail(email),
      password,
    }
  },
  async verify({ email, password }, context) {
    let db = context.get(Database)
    let user = await db.findOne(users, { where: { email } })

    if (user == null || typeof user.password_hash !== 'string' || user.password_hash === '') {
      return null
    }

    if (!(await verifyPassword(password, user.password_hash))) {
      return null
    }

    return user
  },
})

export function requireAuth(): Middleware {
  return requireAuthenticated({
    onFailure() {
      return redirect(routes.home.href())
    },
  })
}

export function getGoodAuth(context: { get(key: typeof Auth): unknown }): GoodAuth<SocialLoginIdentity> {
  return context.get(Auth) as GoodAuth<SocialLoginIdentity>
}

export function getPostAuthRedirect(url: URL, fallback = routes.account.href()): string {
  return getSafeReturnTo(url.searchParams.get('returnTo')) ?? fallback
}

export function getReturnToQuery(url: URL): { returnTo?: string } {
  let returnTo = getSafeReturnTo(url.searchParams.get('returnTo'))
  return returnTo ? { returnTo } : {}
}

export function flashError(session: Session, message: string): void {
  session.flash('error', message)
}

export function flashSuccess(session: Session, message: string): void {
  session.flash('success', message)
}

export function readFlash(session: Session): { error?: string; success?: string } {
  let error = session.get('error')
  let success = session.get('success')

  return {
    error: typeof error === 'string' ? error : undefined,
    success: typeof success === 'string' ? success : undefined,
  }
}

export function getSafeReturnTo(returnTo: string | null): string | undefined {
  if (returnTo == null || returnTo === '') {
    return undefined
  }

  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return undefined
  }

  return returnTo
}

export { clearAuthenticatedSession, writeAuthenticatedSession }
