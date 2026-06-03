import { createController, type RouteBuilder, type RouterTypes } from 'remix/router'
import { completeAuth, verifyCredentials } from 'remix/auth'
import { redirect } from 'remix/response/redirect'

import { forgotPasswordController } from './forgot-password/controller.tsx'
import { createGitHubAuthController } from './github/controller.ts'
import { createGoogleAuthController } from './google/controller.ts'
import { resetPasswordController } from './reset-password/controller.tsx'
import { signupController } from './signup/controller.tsx'
import { createXAuthController } from './x/controller.ts'
import { getPostAuthRedirect, getReturnToQuery, passwordProvider } from '../../middleware/auth.ts'
import { authRoutes, routes } from '../../routes.ts'
import {
  externalProviderRegistry,
  type ExternalProviderRegistry,
} from '../../utils/external-auth.ts'

export function installAuthRoutes(
  router: RouteBuilder<RouterTypes['context']>,
  registry: ExternalProviderRegistry = externalProviderRegistry,
) {
  router.map(authRoutes, createAuthController())
  router.map(authRoutes.signup, signupController)
  router.map(authRoutes.forgotPassword, forgotPasswordController)
  router.map(authRoutes.resetPassword, resetPasswordController)
  router.map(authRoutes.google, createGoogleAuthController(registry))
  router.map(authRoutes.github, createGitHubAuthController(registry))
  router.map(authRoutes.x, createXAuthController(registry))
}

export function createAuthController() {
  return createController(authRoutes, {
    actions: {
      async login(context) {
        let { session, url } = context

        try {
          let user = await verifyCredentials(passwordProvider, context)

          if (user == null) {
            session.flash('error', 'Invalid email or password. Please try again.')
            return redirect(routes.home.href(undefined, getReturnToQuery(url)))
          }

          let authSession = completeAuth(context)
          authSession.set('auth', {
            userId: user.id,
            loginMethod: 'credentials',
          })

          return redirect(getPostAuthRedirect(url))
        } catch {
          session.flash('error', 'We could not complete that sign-in request.')
          return redirect(routes.home.href(undefined, getReturnToQuery(url)))
        }
      },

      logout({ session }) {
        session.unset('auth')
        session.regenerateId(true)
        return redirect(routes.home.href())
      },
    },
  })
}
