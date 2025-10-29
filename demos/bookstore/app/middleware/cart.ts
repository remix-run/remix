import type { Middleware } from '@remix-run/fetch-router'
import { createCartIfNotExists } from '../models/cart.ts'

/**
 * Middleware that ensures the user session has an associated cart
 * To be used on any route that mutates the cart
 */
export const ensureCart: Middleware = async ({ session }) => {
  createCartIfNotExists(session)
}
