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

type RouteParams = Record<string, string>

type AppMiddleware = [
  ReturnType<typeof staticFiles>,
  ReturnType<typeof formData>,
  ReturnType<typeof session>,
  ReturnType<typeof loadDatabase>,
  ReturnType<typeof loadAuth>,
]

type AppStore = MiddlewareContext<AppMiddleware> extends RequestContext<
  any,
  infer store extends RequestContextStore
>
  ? store
  : never

export type RouteContext<params extends RouteParams = {}> = RequestContext<params, AppStore>

type AppRouter<params extends RouteParams = {}> = Router<RouteContext<params>, RouteContext<params>>

export function defineRoute<params extends RouteParams = {}>(
  handler: (context: RouteContext<params>) => Response | Promise<Response>,
) {
  return handler
}

export function defineRoutes<params extends RouteParams = {}>(
  mount: (router: AppRouter<params>) => void,
) {
  return mount
}

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
