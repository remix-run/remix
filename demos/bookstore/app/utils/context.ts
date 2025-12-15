import { createStorageKey } from 'remix'
import { getContext } from 'remix/platform'

import { type Cart, getCart } from '../models/cart.ts'
import type { User } from '../models/users.ts'

// Storage key for attaching user data to request context
let USER_KEY = createStorageKey<User>()

/**
 * Get the current authenticated user from app storage.
 */
export function getCurrentUser(): User {
  return getContext().storage.get(USER_KEY)
}

/**
 * Get the current authenticated user from app storage, or null if not authenticated.
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
 * Set the current authenticated user in app storage.
 */
export function setCurrentUser(user: User): void {
  getContext().storage.set(USER_KEY, user)
}

/**
 * Get the current cart from the session.
 */
export function getCurrentCart(): Cart {
  return getCart(getContext().session.get('cart'))
}
