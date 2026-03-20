import type { Router } from 'remix/fetch-router'

import { mountExternalProviderRoutes } from './external-auth-actions.ts'
import { mountForgotPasswordRoutes } from './forgot-password-actions.tsx'
import { login } from './login-action.ts'
import { logout } from './logout-action.ts'
import { mountResetPasswordRoutes } from './reset-password-actions.tsx'
import { mountSignupRoutes } from './signup-actions.tsx'
import type { SocialAuthRouteContext } from '../../router.ts'

export function mountAuthRoutes<context extends SocialAuthRouteContext<Record<string, string>>>(
  router: Router<context, context>,
): void {
  router.post('/login', login)
  router.post('/logout', logout)

  router.mount('/signup', mountSignupRoutes)
  router.mount('/forgot-password', mountForgotPasswordRoutes)
  router.mount('/reset-password/:token', mountResetPasswordRoutes)

  router.mount('/google', google => {
    mountExternalProviderRoutes(google, 'google')
  })

  router.mount('/github', github => {
    mountExternalProviderRoutes(github, 'github')
  })

  router.mount('/x', x => {
    mountExternalProviderRoutes(x, 'x')
  })
}
