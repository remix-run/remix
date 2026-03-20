import type { Controller } from 'remix/fetch-router'

import {
  githubAuthController,
  googleAuthController,
  xAuthController,
} from './external-auth-controllers.ts'
import { forgotPasswordController } from './forgot-password-controller.tsx'
import { login } from './login-action.ts'
import { logout } from './logout-action.ts'
import { resetPasswordController } from './reset-password-controller.tsx'
import { signupController } from './signup-controller.tsx'
import type { AppContext } from '../../router.ts'
import type { routes } from '../../routes.ts'

export let authController = {
  actions: {
    login,
    logout,
    signup: signupController,
    forgotPassword: forgotPasswordController,
    resetPassword: resetPasswordController,
    google: googleAuthController,
    github: githubAuthController,
    x: xAuthController,
  },
} satisfies Controller<typeof routes.auth, AppContext>
