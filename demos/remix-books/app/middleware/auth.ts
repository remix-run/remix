import type { RequestContext } from '@remix-run/fetch-router'
import { createStorageKey } from '@remix-run/fetch-router'

import { routes } from '../../routes.ts'
import { getSession, getUserIdFromSession } from '../lib/session.ts'
import { getUserById } from '../models/users.ts'
import type { User } from '../models/users.ts'
import { redirect } from '../views/layout.ts'

// Storage keys for attaching data to request context
const USER_KEY = createStorageKey<User | undefined>(undefined)
const SESSION_ID_KEY = createStorageKey<string | undefined>(undefined)

/**
 * Middleware that requires a user to be authenticated.
 * Redirects to login if not authenticated.
 * Attaches user and sessionId to context.storage.
 */
export function requireAuth(ctx: RequestContext) {
  let session = getSession(ctx.request)
  let userId = getUserIdFromSession(session.sessionId)

  if (!userId) {
    return redirect(routes.auth.login.href(), ctx.url)
  }

  let user = getUserById(userId)
  if (!user) {
    return redirect(routes.auth.login.href(), ctx.url)
  }

  ctx.storage.set(USER_KEY, user)
  ctx.storage.set(SESSION_ID_KEY, session.sessionId)
}

/**
 * Middleware that optionally loads the current user if authenticated.
 * Does not redirect if not authenticated.
 * Attaches user (if any) and sessionId to context.storage.
 */
export function loadAuth(ctx: RequestContext) {
  let session = getSession(ctx.request)
  let userId = getUserIdFromSession(session.sessionId)

  let user: User | undefined
  if (userId) {
    user = getUserById(userId)
  }

  if (user) {
    ctx.storage.set(USER_KEY, user)
  }

  ctx.storage.set(SESSION_ID_KEY, session.sessionId)
}

/**
 * Helper to get the authenticated user from context storage.
 * Returns undefined if user hasn't been loaded by middleware.
 */
export function getUser(ctx: RequestContext): User | undefined {
  try {
    return ctx.storage.get(USER_KEY)
  } catch {
    return undefined
  }
}

/**
 * Helper to get the session ID from context storage.
 * Falls back to getting it from the request if not set by middleware.
 */
export function getSessionId(ctx: RequestContext): string {
  try {
    let sessionId = ctx.storage.get(SESSION_ID_KEY)
    if (sessionId) return sessionId
  } catch {
    // Not set by middleware, get from request
  }

  let session = getSession(ctx.request)
  return session.sessionId
}
