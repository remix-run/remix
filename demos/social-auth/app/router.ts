import { createRouter, type MiddlewareContext, type RequestContext, type Router } from 'remix/fetch-router'
import { formData } from 'remix/form-data-middleware'
import type { Cookie } from 'remix/cookie'
import type { SessionStorage } from 'remix/session'
import { session } from 'remix/session-middleware'
import { staticFiles } from 'remix/static-middleware'

import { initializeSocialAuthDatabase } from './data/setup.ts'
import { createAccountRouter } from './controllers/account/controller.tsx'
import { createAuthRouter } from './controllers/auth/controller.tsx'
import { home } from './controllers/home/controller.tsx'
import { loadAuth } from './middleware/auth.ts'
import { loadDatabase } from './middleware/database.ts'
import { routes } from './routes.ts'
import { sessionCookie, sessionStorage } from './middleware/session.ts'

await initializeSocialAuthDatabase()

export type SocialAuthMiddleware = [
  ReturnType<typeof staticFiles>,
  ReturnType<typeof formData>,
  ReturnType<typeof session>,
  ReturnType<typeof loadDatabase>,
  ReturnType<typeof loadAuth>,
]

export type SocialAuthContext = MiddlewareContext<SocialAuthMiddleware>
export type SocialAuthStore = SocialAuthContext extends RequestContext<
  infer _params extends Record<string, string>,
  infer store
>
  ? store
  : never

export type SocialAuthRouteContext<params extends Record<string, string> = {}> = RequestContext<
  params,
  SocialAuthStore
>

export type SocialAuthRouter<params extends Record<string, string> = {}> = Router<
  SocialAuthRouteContext<params>,
  SocialAuthRouteContext<params>
>

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

  router.get(routes.home, home)
  router.mount('/account', createAccountRouter())
  router.mount('/auth', createAuthRouter())

  return router
}

export let router = createSocialAuthRouter()
