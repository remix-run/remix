import { getContext } from 'remix/middleware/async-context'
import { Auth } from 'remix/middleware/auth'
import type { AuthState } from 'remix/middleware/auth'

import type { User } from '../data/schema.ts'
import { Session } from '../middleware/session.ts'
import { getCart, type Cart } from './cart.ts'

export function getCurrentUser(): User {
  let auth = getCurrentAuth()

  if (!auth.ok) {
    throw new Error(
      'Expected an authenticated user. Make sure requireAuth() runs before this code.',
    )
  }

  return auth.identity
}

export function getCurrentUserSafely(): User | null {
  let auth = getCurrentAuth()

  return auth.ok ? auth.identity : null
}

export function getCurrentCart(): Cart {
  return getCart(getContext().get(Session).get('cart'))
}

function getCurrentAuth(): AuthState<User> {
  return getContext().get(Auth)
}
