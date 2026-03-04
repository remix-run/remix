import type { Middleware } from 'remix/fetch-router'
import type { Route } from 'remix/fetch-router/routes'
import { redirect } from 'remix/response/redirect'

import { routes } from '../routes.ts'
import { users } from '../data/schema.ts'
import { setCurrentUser } from '../utils/context.ts'
import { parseId } from '../utils/ids.ts'

/**
 * Middleware that optionally loads the current user if authenticated.
 * Does not redirect if not authenticated.
 * Attaches user (if any) to request context.
 */
export function loadAuth(): Middleware {
  return async ({ db, session }) => {
    let userId = parseId(session.get('userId'))

    if (userId !== undefined) {
      let user = await db.find(users, userId)
      if (user) {
        setCurrentUser(user)
      }
    }
  }
}

export interface RequireAuthOptions {
  /**
   * Where to redirect if the user is not authenticated.
   * Defaults to the login page.
   */
  redirectTo?: Route
}

/**
 * Middleware that requires a user to be authenticated.
 * Redirects to login if not authenticated.
 * Attaches user to request context.
 */
export function requireAuth(options?: RequireAuthOptions): Middleware {
  let redirectRoute = options?.redirectTo ?? routes.auth.login.index

  return async ({ db, session, url }) => {
    let userId = parseId(session.get('userId'))
    let user = userId === undefined ? undefined : await db.find(users, userId)

    if (!user) {
      // Capture the current URL to redirect back to after login
      return redirect(redirectRoute.href(undefined, { returnTo: url.pathname + url.search }), 302)
    }

    setCurrentUser(user)
  }
}
