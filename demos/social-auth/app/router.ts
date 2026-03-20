import {
  createRouter,
  type MiddlewareContext,
  type RequestContext,
  type RequestContextStore,
  type Router,
} from 'remix/fetch-router'
import type { Cookie } from 'remix/cookie'
import { formData } from 'remix/form-data-middleware'
import type { SessionStorage } from 'remix/session'
import { session } from 'remix/session-middleware'
import { staticFiles } from 'remix/static-middleware'

import { mountAccountRoutes } from './controllers/account/controller.tsx'
import { mountAuthRoutes } from './controllers/auth/controller.tsx'
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

export type SocialAuthContext = MiddlewareContext<SocialAuthMiddleware>

type SocialAuthContextStore = SocialAuthContext extends RequestContext<
  any,
  infer store extends RequestContextStore
>
  ? store
  : never

export type SocialAuthRouteContext<params extends Record<string, string> = {}> = RequestContext<
  params,
  SocialAuthContextStore
>

export type SocialAuthRouter<params extends Record<string, string> = {}> = Router<
  SocialAuthRouteContext<params>,
  SocialAuthRouteContext<params>
>

export type SocialAuthMount<params extends Record<string, string> = {}> = (
  router: SocialAuthRouter<params>,
) => void

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
  router.mount('/account', mountAccountRoutes)
  router.mount('/auth', mountAuthRoutes)

  return router
}

export let router = createSocialAuthRouter()
