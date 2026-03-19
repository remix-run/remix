import { createRouter } from 'remix/fetch-router'
import { formData } from 'remix/form-data-middleware'
import type { Cookie } from 'remix/cookie'
import type { SessionStorage } from 'remix/session'
import { session } from 'remix/session-middleware'

import { initializeSocialLoginDatabase } from './data/setup.ts'
import { loadAuth } from './middleware/auth.ts'
import { loadDatabase } from './middleware/database.ts'
import { account } from './account.tsx'
import authController from './auth.tsx'
import { home } from './home.tsx'
import { routes } from './routes.ts'
import { sessionCookie, sessionStorage } from './utils/session.ts'

await initializeSocialLoginDatabase()

export interface SocialLoginRouterOptions {
  sessionCookie?: Cookie
  sessionStorage?: SessionStorage
}

export function createSocialLoginRouter(options?: SocialLoginRouterOptions) {
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

export let router = createSocialLoginRouter()
