import { createStorageKey } from 'remix/fetch-router'
import { getContext } from 'remix/async-context-middleware'

import { getCart } from '../data/cart.ts'
import type { Cart } from '../data/cart.ts'
import type { User } from '../data/schema.ts'

// Storage key for attaching user data to request context
let USER_KEY = createStorageKey<User>()

/**
 * Get the current authenticated user from request context.
 */
export function getCurrentUser(): User {
  return getContext().get(USER_KEY)
}

/**
 * Get the current authenticated user from request context, or null if not authenticated.
 * Safe to use when running behind loadAuth middleware (not requireAuth).
 */
export function getCurrentUserSafely(): User | null {
  try {
    return getCurrentUser()
  } catch {
    return null
  }
}

/**
 * Set the current authenticated user in request context.
 */
export function setCurrentUser(user: User): void {
  getContext().set(USER_KEY, user)
}

/**
 * Get the current cart from the session.
 */
export function getCurrentCart(): Cart {
  return getCart(getContext().session.get('cart'))
}
