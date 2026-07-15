import { createMiddleware, createRouter, type MiddlewareContext } from 'remix/router'
import type { Cookie } from 'remix/cookie'
import { formData } from 'remix/middleware/form-data'
import { render } from 'remix/middleware/render'
import type { SessionStorage } from 'remix/session'
import { session } from 'remix/middleware/session'
import { staticFiles } from 'remix/middleware/static'

import { createAuthController } from './actions/auth/controller.tsx'
import { forgotPasswordController } from './actions/auth/forgot-password/controller.tsx'
import { createGitHubAuthController } from './actions/auth/github/controller.ts'
import { createGoogleAuthController } from './actions/auth/google/controller.ts'
import { resetPasswordController } from './actions/auth/reset-password/controller.tsx'
import { signupController } from './actions/auth/signup/controller.tsx'
import { createXAuthController } from './actions/auth/x/controller.ts'
import { createRootController } from './actions/controller.tsx'
import { loadAuth } from './middleware/auth.ts'
import { loadDatabase } from './middleware/database.ts'
import { sessionCookie, sessionStorage } from './middleware/session.ts'
import { routes } from './routes.ts'
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
  router.map(routes.auth, createAuthController())
  router.map(routes.auth.signup, signupController)
  router.map(routes.auth.forgotPassword, forgotPasswordController)
  router.map(routes.auth.resetPassword, resetPasswordController)
  router.map(routes.auth.google, createGoogleAuthController(providers))
  router.map(routes.auth.github, createGitHubAuthController(providers))
  router.map(routes.auth.x, createXAuthController(providers))

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
