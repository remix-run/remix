import {
  createRouter,
  type MiddlewareContext,
  type RequestContext,
  type RequestContextStore,
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
import { loadAuth } from './middleware/auth.ts'
import { loadDatabase } from './middleware/database.ts'
import { sessionCookie, sessionStorage } from './middleware/session.ts'
import { routes } from './routes.ts'

await initializeSocialAuthDatabase()

export type SocialAuthMiddleware = [
  ReturnType<typeof staticFiles>,
  ReturnType<typeof formData>,
  ReturnType<typeof session>,
  ReturnType<typeof loadDatabase>,
  ReturnType<typeof loadAuth>,
]

type AppStore = MiddlewareContext<SocialAuthMiddleware> extends RequestContext<
  any,
  infer store extends RequestContextStore
>
  ? store
  : never

export type RouteContext<params extends Record<string, string> = {}> = RequestContext<params, AppStore>

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
  router.map(routes.account, accountAction)
  router.map(routes.auth, authController)

  return router
}

export let router = createSocialAuthRouter()
