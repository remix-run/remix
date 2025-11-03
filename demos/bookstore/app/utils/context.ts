import { AsyncLocalStorage } from 'node:async_hooks'
import type { RequestContext } from '@remix-run/fetch-router'

import { USER_KEY } from '../middleware/auth.ts'
import type { User } from '../models/users.ts'

export const requestContextStorage = new AsyncLocalStorage<RequestContext>()

/**
 * Get the current RequestContext from AsyncLocalStorage.
 * This can be called from anywhere in your application during a request.
 */
export function getContext(): RequestContext {
  let context = requestContextStorage.getStore()

  if (!context) {
    throw new Error('No request context found. Make sure the storeContext middleware is installed.')
  }

  return context
}

/**
 * Get the storage from the current RequestContext.
 * This is a convenience helper for the most common use case.
 */
export function getStorage() {
  return getContext().storage
}

/**
 * Get the session from the current RequestContext.
 * This is a convenience helper for the most common use case.
 */
export function getSession() {
  return getContext().session
}

/**
 * Get the current authenticated user from storage.
 * Throws if no user is authenticated.
 */
export function getCurrentUser(): User {
  return getStorage().get(USER_KEY)
}
