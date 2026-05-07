import type { Route } from 'remix/routes'
import { createCredentialsAuthProvider } from 'remix/auth'
import { Auth, auth, createSessionAuthScheme, type GoodAuth } from 'remix/auth-middleware'
import { Database } from 'remix/data-table'
import type { Middleware } from 'remix/fetch-router'
import { redirect } from 'remix/response/redirect'

import { users } from '../data/schema.ts'
import type { User } from '../data/schema.ts'
import { routes } from '../routes.ts'
import { parseId } from '../utils/ids.ts'
import { verifyPassword } from '../utils/password-hash.ts'

interface BookstoreAuthSession {
  userId: number
}

export function loadAuth() {
  return auth({
    schemes: [
      createSessionAuthScheme<User, BookstoreAuthSession>({
        read(session) {
          return parseBookstoreAuthSession(session.get('auth'))
        },
        async verify(value, context) {
          let db = context.get(Database)
          if (db == null) {
            throw new Error('Expected database middleware before auth middleware')
          }

          return (await db.find(users, value.userId)) ?? null
        },
        invalidate(session) {
          session.unset('auth')
        },
      }),
    ],
  })
}

export const passwordProvider = createCredentialsAuthProvider({
  parse(context) {
    let formData = context.get(FormData)
    if (formData == null) {
      throw new Error('Expected formData() middleware before password auth provider')
    }

    return {
      email: normalizeEmail(formData.get('email')?.toString() ?? ''),
      password: formData.get('password')?.toString() ?? '',
    }
  },
  async verify({ email, password }, context) {
    let db = context.get(Database)
    if (db == null) {
      throw new Error('Expected database middleware before password auth provider')
    }

    let user = await db.findOne(users, { where: { email } })

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return null
    }

    return user
  },
})

export interface RequireAuthOptions {
  redirectTo?: Route
}

type RequireBookstoreUserTransform = readonly [readonly [typeof Auth, GoodAuth<User>]]

export function requireAuth(
  options?: RequireAuthOptions,
): Middleware<any, RequireBookstoreUserTransform> {
  let redirectTo = options?.redirectTo ?? routes.auth.login.index

  return (context, next) => {
    let authState = context.get(Auth)
    if (authState == null) {
      throw new Error('Auth state not found. Make sure loadAuth() runs before requireAuth().')
    }

    if (authState.ok) {
      return next()
    }

    return redirect(
      redirectTo.href(undefined, {
        returnTo:
          getSafeReturnTo(context.url.searchParams.get('returnTo')) ??
          context.url.pathname + context.url.search,
      }),
    )
  }
}

export function getPostAuthRedirect(url: URL, fallback = routes.account.index.href()): string {
  return getSafeReturnTo(url.searchParams.get('returnTo')) ?? fallback
}

export function getLoginRedirectURL(
  url: URL,
  route: Route<any, any> = routes.auth.login.index,
): string {
  return route.href(undefined, {
    returnTo: getSafeReturnTo(url.searchParams.get('returnTo')),
  })
}

function parseBookstoreAuthSession(value: unknown): BookstoreAuthSession | null {
  if (typeof value !== 'object' || value == null) {
    return null
  }

  let userId = parseId((value as { userId?: unknown }).userId)

  if (userId == null) {
    return null
  }

  return { userId }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function getSafeReturnTo(returnTo: string | null): string | undefined {
  if (returnTo == null || returnTo === '') {
    return undefined
  }

  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return undefined
  }

  return returnTo
}
