import { AsyncLocalStorage } from 'node:async_hooks'
import type { Middleware } from '@remix-run/fetch-router'
import type { AuthClientBase, AuthUser } from '@remix-run/auth'

/**
 * Create auth middleware and typed user getter for your auth client.
 *
 * **Requires:**
 * - `session()` middleware - to load and persist sessions
 *
 * Returns an object with:
 * - `auth`: Middleware that loads and caches the current user
 * - `getUser`: Function to synchronously get the cached user
 *
 * For protected routes, check the user manually:
 * ```ts
 * let user = getUser()
 * if (!user) {
 *   return redirect('/login?returnTo=' + url.pathname)
 * }
 * ```
 *
 * @param authClient The auth client instance (with your User type)
 * @returns Object with `auth` middleware and typed `getUser` function
 *
 * @example
 * ```ts
 * // In app/utils/auth.ts
 * export let authClient = createAuthClient<User>({ ... })
 * export let { auth, getUser } = createAuthMiddleware(authClient)
 *
 * // In app/router.ts
 * import { auth } from './utils/auth.ts'
 * router.use(auth)
 *
 * // In handlers
 * import { getUser } from './utils/auth.ts'
 * let user = getUser() // Typed as User | null
 * ```
 */
export function createAuthMiddleware(authClient: AuthClientBase<AuthUser>) {
  // Each auth client gets its own storage instance
  let userStorage = new AsyncLocalStorage<AuthUser | null>()

  let auth: Middleware = async ({ session }, next) => {
    let user = await authClient.getUser(session)
    return userStorage.run(user, () => next())
  }

  function getUser(): AuthUser | null {
    return userStorage.getStore() ?? null
  }

  return { auth, getUser }
}
