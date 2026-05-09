import { getContext } from 'remix/async-context-middleware'
import type { AuthState } from 'remix/auth-middleware'
import type { Session } from 'remix/session'

import type { User } from '../data/schema.ts'
import { getCart, type Cart } from './cart.ts'

export function getCurrentUser(auth: AuthState<User> = getContext().auth): User {
  if (!auth.ok) {
    throw new Error(
      'Expected an authenticated user. Make sure requireAuth() runs before this code.',
    )
  }

  return auth.identity
}

export function getCurrentUserSafely(auth: AuthState<User> = getContext().auth): User | null {
  return auth.ok ? auth.identity : null
}

export function getCurrentCart(session: Session = getContext().session): Cart {
  return getCart(session.get('cart'))
}
