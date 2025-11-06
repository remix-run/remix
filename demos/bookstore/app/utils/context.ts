import { getContext } from '@remix-run/fetch-router/async-context-middleware'

import { USER_KEY } from '../middleware/auth.ts'
import type { User } from '../models/users.ts'

/**
 * Get the app storage from the current request context.
 */
export function getStorage() {
  return getContext().storage
}

/**
 * Get the current authenticated user from app storage.
 */
export function getCurrentUser(): User {
  return getStorage().get(USER_KEY)
}
