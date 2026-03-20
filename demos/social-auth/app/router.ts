import { createRouter } from 'remix/fetch-router'
import { formData } from 'remix/form-data-middleware'
import type { Cookie } from 'remix/cookie'
import type { SessionStorage } from 'remix/session'
import { session } from 'remix/session-middleware'

import { initializeSocialAuthDatabase } from '../data/setup.ts'
import { account } from './controllers/account/controller.tsx'
import authController from './controllers/auth/controller.tsx'
import { home } from './controllers/home/controller.tsx'
import { loadAuth } from './middleware/auth.ts'
import { loadDatabase } from './middleware/database.ts'
import { routes } from './routes.ts'
import { sessionCookie, sessionStorage } from './utils/session.ts'

await initializeSocialAuthDatabase()

export interface SocialAuthRouterOptions {
  sessionCookie?: Cookie
  sessionStorage?: SessionStorage
}

export function createSocialAuthRouter(options?: SocialAuthRouterOptions) {
  let cookie = options?.sessionCookie ?? sessionCookie
  let storage = options?.sessionStorage ?? sessionStorage
  let router = createRouter({
    middleware: [formData(), session(cookie, storage), loadDatabase(), loadAuth()],
  })

  router.get(routes.home, home)
  router.get(routes.account, account)
  router.map(routes.auth, authController)

  return router
}

export let router = createSocialAuthRouter()
