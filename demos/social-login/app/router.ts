import type { Cookie } from 'remix/cookie'
import { createRouter } from 'remix/fetch-router'
import type { SessionStorage } from 'remix/session'
import { compression } from 'remix/compression-middleware'
import { logger } from 'remix/logger-middleware'
import { session as sessionMiddleware } from 'remix/session-middleware'
import { staticFiles } from 'remix/static-middleware'

import { createAuthController } from './auth.tsx'
import { getSocialLoginConfig, type SocialLoginConfig } from './config.ts'
import { createHomeAction } from './home.tsx'
import { loadAuth } from './middleware/auth.ts'
import { routes } from './routes.ts'
import { sessionCookie, sessionStorage } from './utils/session.ts'

export interface SocialLoginRouterOptions {
  config?: SocialLoginConfig
  sessionCookie?: Cookie
  sessionStorage?: SessionStorage
}

export function createSocialLoginRouter(options?: SocialLoginRouterOptions) {
  let config = options?.config ?? getSocialLoginConfig()
  let cookie = options?.sessionCookie ?? sessionCookie
  let storage = options?.sessionStorage ?? sessionStorage
  let middleware = []

  if (process.env.NODE_ENV === 'development') {
    middleware.push(logger())
  }

  middleware.push(compression())
  middleware.push(
    staticFiles('./public', {
      cacheControl: 'no-store, must-revalidate',
      etag: false,
      lastModified: false,
    }),
  )
  middleware.push(sessionMiddleware(cookie, storage))
  middleware.push(loadAuth())

  let router = createRouter({ middleware })

  router.map(routes.home, createHomeAction(config))
  router.map(routes.auth, createAuthController(config))

  return router
}
