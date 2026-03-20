import type { WithRequiredAuth } from 'remix/auth-middleware'
import {
  createRouter,
  type MiddlewareContext,
  type WithContextParams,
} from 'remix/fetch-router'
import type { Cookie } from 'remix/cookie'
import { formData } from 'remix/form-data-middleware'
import type { SessionStorage } from 'remix/session'
import { session } from 'remix/session-middleware'
import { staticFiles } from 'remix/static-middleware'

import { accountAction } from './controllers/account/controller.tsx'
import { authController } from './controllers/auth/controller.tsx'
import { home } from './controllers/home/controller.tsx'
import { initializeSocialAuthDatabase } from './data/setup.ts'
import { loadAuth, requireAuth } from './middleware/auth.ts'
import { loadDatabase } from './middleware/database.ts'
import { sessionCookie, sessionStorage } from './middleware/session.ts'
import { routes } from './routes.ts'
import type { AuthIdentity } from './utils/auth-session.ts'

await initializeSocialAuthDatabase()

export type SocialAuthMiddleware = [
  ReturnType<typeof staticFiles>,
  ReturnType<typeof formData>,
  ReturnType<typeof session>,
  ReturnType<typeof loadDatabase>,
  ReturnType<typeof loadAuth>,
]

export type RouteContext<params extends Record<string, string> = {}> = WithContextParams<
  MiddlewareContext<SocialAuthMiddleware>,
  params
>

export type AuthenticatedRouteContext<params extends Record<string, string> = {}> =
  WithRequiredAuth<RouteContext<params>, AuthIdentity>

export interface SocialAuthRouterOptions {
  sessionCookie?: Cookie
  sessionStorage?: SessionStorage
}

export function createSocialAuthRouter(options?: SocialAuthRouterOptions) {
  let cookie = options?.sessionCookie ?? sessionCookie
  let storage = options?.sessionStorage ?? sessionStorage
  let middleware = [
    staticFiles('./public', {
      cacheControl: 'no-store, must-revalidate',
      etag: false,
      lastModified: false,
    }),
    formData(),
    session(cookie, storage),
    loadDatabase(),
    loadAuth(),
  ] as const
  let router = createRouter({ middleware })

  router.map(routes.home, home)
  router.get(routes.account, {
    middleware: [requireAuth] as const,
    action: accountAction.action,
  })
  router.map(routes.auth, authController)

  return router
}

export let router = createSocialAuthRouter()
