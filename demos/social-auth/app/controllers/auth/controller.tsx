import type { Controller } from 'remix/fetch-router'

import { forgotPasswordController } from './forgot-password/controller.tsx'
import { githubAuthController } from './github/controller.ts'
import { googleAuthController } from './google/controller.ts'
import { login } from './login-action.ts'
import { logout } from './logout-action.ts'
import { resetPasswordController } from './reset-password/controller.tsx'
import { signupController } from './signup/controller.tsx'
import { xAuthController } from './x/controller.ts'
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
