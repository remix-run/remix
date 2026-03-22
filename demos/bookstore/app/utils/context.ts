import { getContext } from 'remix/async-context-middleware'
import { Auth } from 'remix/auth-middleware'
import type { AuthState } from 'remix/auth-middleware'

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
