import { createMiddleware, createRouter, type MiddlewareContext } from 'remix/router'
import type { Cookie } from 'remix/cookie'
import { formData } from 'remix/middleware/form-data'
import type { SessionStorage } from 'remix/session'
import { session } from 'remix/middleware/session'
import { staticFiles } from 'remix/middleware/static'

import { installAuthRoutes } from './actions/auth/controller.tsx'
import { createRootController } from './actions/controller.tsx'
import { loadAuth } from './middleware/auth.ts'
import { loadDatabase } from './middleware/database.ts'
import { render } from './middleware/render.tsx'
import { sessionCookie, sessionStorage } from './middleware/session.ts'
import { authBase, routes } from './routes.ts'
import { externalProviderRegistry, type ExternalProviderRegistry } from './utils/external-auth.ts'

type AppMiddleware = ReturnType<typeof createSocialAuthMiddleware>
type AppContext = MiddlewareContext<AppMiddleware>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}

export interface SocialAuthRouterOptions {
  sessionCookie?: Cookie
  sessionStorage?: SessionStorage
  externalProviderRegistry?: ExternalProviderRegistry
}

export function createSocialAuthRouter(options?: SocialAuthRouterOptions) {
  let cookie = options?.sessionCookie ?? sessionCookie
  let storage = options?.sessionStorage ?? sessionStorage
  let providers = options?.externalProviderRegistry ?? externalProviderRegistry
  let router = createRouter({ middleware: createSocialAuthMiddleware(cookie, storage) })

  router.map(routes, createRootController(providers))
  router.mount(authBase, (auth) => installAuthRoutes(auth, providers))

  return router
}

function createSocialAuthMiddleware(cookie: Cookie, storage: SessionStorage) {
  return createMiddleware(
    staticFiles('./public', {
      cacheControl: 'no-store, must-revalidate',
      etag: false,
      lastModified: false,
    }),
    formData(),
    session(cookie, storage),
    loadDatabase(),
    loadAuth(),
    render(),
  )
}
