import type { Middleware } from '@remix-run/fetch-router'

import { getUser } from './auth.ts'

/**
 * Middleware that requires a user to have admin role.
 * Returns 403 Forbidden if user is not an admin.
 * Must be used after requireAuth middleware.
 */
export let requireAdmin: Middleware = async (ctx, next) => {
  let user = getUser(ctx)

  // User should be set by requireAuth middleware
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Check if user has admin role
  if (user.role !== 'admin') {
    return new Response('Forbidden', { status: 403 })
  }

  return next()
}
