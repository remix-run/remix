import type { Controller } from 'remix/fetch-router'

import { createExternalProviderActions } from './external-auth-actions.ts'
import { forgotPasswordActions } from './forgot-password-actions.tsx'
import { loginAction } from './login-action.ts'
import { logoutAction } from './logout-action.ts'
import { resetPasswordActions } from './reset-password-actions.tsx'
import { signupActions } from './signup-actions.tsx'
import type { routes } from '../../routes.ts'

let authController = {
  actions: {
    login: loginAction,
    logout: logoutAction,
    signup: signupActions,
    forgotPassword: forgotPasswordActions,
    resetPassword: resetPasswordActions,
    google: createExternalProviderActions('google'),
    github: createExternalProviderActions('github'),
    x: createExternalProviderActions('x'),
  },
} satisfies Controller<typeof routes.auth>

export default authController
