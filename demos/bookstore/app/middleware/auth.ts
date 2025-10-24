import { createStorageKey } from '@remix-run/fetch-router'
import type { Middleware } from '@remix-run/fetch-router'
import { redirect } from '@remix-run/fetch-router/response-helpers'

import { routes } from '../../routes.ts'
import { getUserById } from '../models/users.ts'
import type { User } from '../models/users.ts'
import { getUserIdFromSession } from '../utils/session.ts'

// Storage keys for attaching data to request context
export const USER_KEY = createStorageKey<User>()

/**
 * Middleware that optionally loads the current user if authenticated.
 * Does not redirect if not authenticated.
 * Attaches user (if any) and sessionId to context.storage.
 */
export let loadAuth: Middleware = async ({ session, storage }) => {
  let userId = getUserIdFromSession(session)

  // Only set USER_KEY if user is authenticated
  if (userId) {
    let user = getUserById(userId)
    if (user) {
      storage.set(USER_KEY, user)
    }
  }
}

/**
 * Middleware that requires a user to be authenticated.
 * Redirects to login if not authenticated.
 * Attaches user and sessionId to context.storage.
 */
export let requireAuth: Middleware = async ({ session, storage }) => {
  let userId = getUserIdFromSession(session)

  if (!userId) {
    return redirect(routes.auth.login.index.href(), 302)
  }

  let user = getUserById(userId)
  if (!user) {
    return redirect(routes.auth.login.index.href(), 302)
  }

  storage.set(USER_KEY, user)
}
