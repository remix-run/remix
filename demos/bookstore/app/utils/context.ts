import { getContext } from 'remix/async-context-middleware'
import { Auth } from 'remix/auth-middleware'
import type { AuthState } from 'remix/auth-middleware'
import { Session } from 'remix/session'

import { getCart } from '../data/cart.ts'
import type { Cart } from '../data/cart.ts'
import type { User } from '../data/schema.ts'

/**
 * Get the current authenticated user from request context.
 */
export function getCurrentUser(): User {
  let auth = getCurrentAuth()

  if (!auth.ok) {
    throw new Error(
      'Expected an authenticated user. Make sure requireAuth() runs before this code.',
    )
  }

  return auth.identity
}

/**
 * Get the current authenticated user from request context, or null if not authenticated.
 * Safe to use anywhere in the bookstore demo because `loadAuth()` runs globally.
 */
export function getCurrentUserSafely(): User | null {
  let auth = getCurrentAuth()

  return auth.ok ? auth.identity : null
}

/**
 * Get the current cart from the session.
 */
export function getCurrentCart(): Cart {
  return getCart(getContext().get(Session).get('cart'))
}

function getCurrentAuth(): AuthState<User> {
  return getContext().get(Auth)
}
