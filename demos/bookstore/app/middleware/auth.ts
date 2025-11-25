import type { Middleware, Route } from '@remix-run/fetch-router'
import { createRedirectResponse as redirect } from '@remix-run/response/redirect'

import { routes } from '../routes.ts'
import { getUserById } from '../models/users.ts'
import { setCurrentUser } from '../utils/context.ts'

/**
 * Middleware that optionally loads the current user if authenticated.
 * Does not redirect if not authenticated.
 * Attaches user (if any) to context.storage.
 */
export function loadAuth(): Middleware {
  return async ({ session }) => {
    let userId = session.get('userId')

    // Only set current user if authenticated
    if (typeof userId === 'string') {
      let user = getUserById(userId)
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
 * Attaches user to context.storage.
 */
export function requireAuth(options?: RequireAuthOptions): Middleware {
  let redirectRoute = options?.redirectTo ?? routes.auth.login.index

  return async ({ session, url }) => {
    let userId = session.get('userId')
    let user = typeof userId === 'string' && getUserById(userId)

    if (!user) {
      // Capture the current URL to redirect back to after login
      return redirect(redirectRoute.href(undefined, { returnTo: url.pathname + url.search }), 302)
    }

    setCurrentUser(user)
  }
}
