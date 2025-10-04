import type { Middleware } from '@remix-run/fetch-router'

import { USER_KEY } from './auth.ts'

/**
 * Middleware that requires a user to have admin role.
 * Returns 403 Forbidden if user is not an admin.
 * Must be used after requireAuth middleware.
 */
export let requireAdmin: Middleware = async ({ storage }) => {
  let user = storage.get(USER_KEY)

  if (user.role !== 'admin') {
    return new Response('Forbidden', { status: 403 })
  }
}
