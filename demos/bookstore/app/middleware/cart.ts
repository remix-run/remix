import { createStorageKey, type Middleware } from '@remix-run/fetch-router'
import { createCartIfNotExists } from '../models/cart.ts'

// Storage keys for attaching data to request context
export const CART_ID_KEY = createStorageKey<string>()

/**
 * Middleware that ensures the user session has an associated cart
 * To be used on any route that mutates the cart
 */
export const ensureCart: Middleware = async ({ session, storage }) => {
  let { cartId } = createCartIfNotExists(session)
  // Put the cartId in storage so it can be strongly typed on retrieval
  storage.set(CART_ID_KEY, cartId)
}
