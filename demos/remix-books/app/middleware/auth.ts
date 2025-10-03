import type { Middleware } from '@remix-run/fetch-router'
import { createStorageKey } from '@remix-run/fetch-router'

import { routes } from '../../routes.ts'
import { getSession, getUserIdFromSession } from '../lib/session.ts'
import { getUserById } from '../models/users.ts'
import type { User } from '../models/users.ts'
import { redirect } from '../views/layout.ts'

// Storage keys for attaching data to request context
export const USER_KEY = createStorageKey<User>()
export const SESSION_ID_KEY = createStorageKey<string>()

/**
 * Middleware that requires a user to be authenticated.
 * Redirects to login if not authenticated.
 * Attaches user and sessionId to context.storage.
 */
export let requireAuth: Middleware = async ({ request, url, storage }, next) => {
  let session = getSession(request)
  let userId = getUserIdFromSession(session.sessionId)

  if (!userId) {
    return redirect(routes.auth.login.href(), url)
  }

  let user = getUserById(userId)
  if (!user) {
    return redirect(routes.auth.login.href(), url)
  }

  storage.set(USER_KEY, user)
  storage.set(SESSION_ID_KEY, session.sessionId)

  return next()
}

/**
 * Middleware that optionally loads the current user if authenticated.
 * Does not redirect if not authenticated.
 * Attaches user (if any) and sessionId to context.storage.
 */
export let loadAuth: Middleware = async ({ request, storage }, next) => {
  let session = getSession(request)
  let userId = getUserIdFromSession(session.sessionId)

  // Always set session ID for cart/guest functionality
  storage.set(SESSION_ID_KEY, session.sessionId)

  // Only set USER_KEY if user is authenticated
  if (userId) {
    let user = getUserById(userId)
    if (user) {
      storage.set(USER_KEY, user)
    }
  }

  return next()
}
