import type { Middleware } from '@remix-run/fetch-router'
import { redirect } from '@remix-run/fetch-router/response-helpers'

import { routes } from '../../routes.ts'
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
  redirectTo?: string
}

/**
 * Middleware that requires a user to be authenticated.
 * Redirects to login if not authenticated.
 * Attaches user to context.storage.
 */
export function requireAuth(options?: RequireAuthOptions): Middleware {
  let redirectTo = options?.redirectTo ?? routes.auth.login.index.href()

  return async ({ session }) => {
    let userId = session.get('userId')

    if (typeof userId !== 'string') {
      return redirect(redirectTo, 302)
    }

    let user = getUserById(userId)
    if (!user) {
      return redirect(redirectTo, 302)
    }

    setCurrentUser(user)
  }
}
