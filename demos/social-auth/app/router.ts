import type { WithRequiredAuth } from 'remix/auth-middleware'
import { createRouter, type MiddlewareContext, type WithParams } from 'remix/fetch-router'
import type { Cookie } from 'remix/cookie'
import { formData } from 'remix/form-data-middleware'
import type { SessionStorage } from 'remix/session'
import { session } from 'remix/session-middleware'
import { staticFiles } from 'remix/static-middleware'

import { accountAction } from './controllers/account/controller.tsx'
import { createAuthController } from './controllers/auth/controller.tsx'
import { createHomeController } from './controllers/home/controller.tsx'
import { loadAuth, requireAuth } from './middleware/auth.ts'
import { loadDatabase } from './middleware/database.ts'
import { sessionCookie, sessionStorage } from './middleware/session.ts'
import { routes } from './routes.ts'
import type { AuthIdentity } from './utils/auth-session.ts'
import { externalProviderRegistry, type ExternalProviderRegistry } from './utils/external-auth.ts'

type RootMiddleware = [
  ReturnType<typeof staticFiles>,
  ReturnType<typeof formData>,
  ReturnType<typeof session>,
  ReturnType<typeof loadDatabase>,
  ReturnType<typeof loadAuth>,
]

export type AppContext<params extends Record<string, string> = {}> = WithParams<
  MiddlewareContext<RootMiddleware>,
  params
>

export type AuthenticatedAppContext<params extends Record<string, string> = {}> = WithRequiredAuth<
  AppContext<params>,
  AuthIdentity
>

export interface SocialAuthRouterOptions {
  sessionCookie?: Cookie
  sessionStorage?: SessionStorage
  externalProviderRegistry?: ExternalProviderRegistry
}

export function createSocialAuthRouter(options?: SocialAuthRouterOptions) {
  let cookie = options?.sessionCookie ?? sessionCookie
  let storage = options?.sessionStorage ?? sessionStorage
  let providers = options?.externalProviderRegistry ?? externalProviderRegistry
  let router = createRouter({
    middleware: [
      staticFiles('./public', {
        cacheControl: 'no-store, must-revalidate',
        etag: false,
        lastModified: false,
      }),
      formData(),
      session(cookie, storage),
      loadDatabase(),
      loadAuth(),
    ] satisfies RootMiddleware,
  })

  router.map(routes.home, createHomeController(providers))
  router.get(routes.account, {
    middleware: [requireAuth],
    handler: accountAction.handler,
  })
  router.map(routes.auth, createAuthController(providers))

  return router
}
