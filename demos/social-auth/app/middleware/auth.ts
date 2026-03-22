import { createCredentialsAuthProvider } from 'remix/auth'
import {
  auth,
  createSessionAuthScheme,
  requireAuth as requireAuthenticated,
} from 'remix/auth-middleware'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { Database, query } from 'remix/data-table'
import { redirect } from 'remix/response/redirect'

import { authAccounts, normalizeEmail, users } from '../data/schema.ts'
import type { AuthIdentity, AuthSession } from '../utils/auth-session.ts'
import { parseAuthSession, parseProviderProfile } from '../utils/auth-session.ts'
import { verifyPassword } from '../utils/password-hash.ts'
import { routes } from '../routes.ts'

let loginSchema = f.object({
  email: f.field(s.defaulted(s.string(), '')),
  password: f.field(s.defaulted(s.string(), '')),
})

export function loadAuth() {
  return auth({
    schemes: [
      createSessionAuthScheme<AuthIdentity, AuthSession>({
        read(session) {
          return parseAuthSession(session.get('auth'))
        },
        async verify(value, context) {
          let db = context.get(Database)
          let user = await db.exec(query(users).find(value.userId))
          if (user == null) {
            return null
          }

          let authAccount =
            value.authAccountId == null
              ? null
              : await db.exec(query(authAccounts).find(value.authAccountId))

          return {
            user,
            loginMethod: value.loginMethod,
            authAccount,
            providerProfile: parseProviderProfile(authAccount),
          }
        },
        invalidate(session) {
          session.unset('auth')
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
    let user = await db.exec(query(users).where({ email }).first())

    if (user == null) {
      return null
    }

    if (typeof user.password_hash === 'string' && user.password_hash !== '') {
      let verified = await verifyPassword(password, user.password_hash)
      return verified ? user : null
    }

    return null
  },
})

export let requireAuth = requireAuthenticated<AuthIdentity>({
  onFailure() {
    return redirect(routes.home.href())
  },
})

export function getPostAuthRedirect(url: URL, fallback = routes.account.href()): string {
  return getSafeReturnTo(url.searchParams.get('returnTo')) ?? fallback
}

export function getReturnToQuery(url: URL): { returnTo?: string } {
  let returnTo = getSafeReturnTo(url.searchParams.get('returnTo'))
  return returnTo ? { returnTo } : {}
}

function getSafeReturnTo(returnTo: string | null): string | undefined {
  if (returnTo == null || returnTo === '') {
    return undefined
  }

  let isSafePath = returnTo.startsWith('/') && returnTo.startsWith('//') === false
  return isSafePath ? returnTo : undefined
}
