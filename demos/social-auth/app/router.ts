import { createRouter, type MiddlewareContext } from 'remix/fetch-router'
import type { Cookie } from 'remix/cookie'
import { formData } from 'remix/form-data-middleware'
import type { SessionStorage } from 'remix/session'
import { session } from 'remix/session-middleware'
import { staticFiles } from 'remix/static-middleware'

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
import { render } from './middleware/render.tsx'
import { sessionCookie, sessionStorage } from './middleware/session.ts'
import { routes } from './routes.ts'
import { externalProviderRegistry, type ExternalProviderRegistry } from './utils/external-auth.ts'

type AppContext = MiddlewareContext<
  [typeof formData, typeof session, typeof loadDatabase, typeof loadAuth, typeof render]
>

declare module 'remix/fetch-router' {
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
  let router = createRouter<AppContext>({
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
      render(),
    ],
  })

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
