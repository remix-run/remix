import { mountExternalProviderRoutes } from './external-auth-actions.ts'
import { mountForgotPasswordRoutes } from './forgot-password-actions.tsx'
import { login } from './login-action.ts'
import { logout } from './logout-action.ts'
import { mountResetPasswordRoutes } from './reset-password-actions.tsx'
import { mountSignupRoutes } from './signup-actions.tsx'
import { defineRoutes } from '../../router.ts'

export let mountAuthRoutes = defineRoutes(router => {
  router.post('/login', login)
  router.post('/logout', logout)

  router.mount('/signup', mountSignupRoutes)
  router.mount('/forgot-password', mountForgotPasswordRoutes)
  router.mount('/reset-password/:token', mountResetPasswordRoutes)

  mountExternalProviderRoutes(router)
})
