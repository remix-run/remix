import type { Controller } from 'remix/fetch-router'

import { forgotPasswordController } from './forgot-password/controller.tsx'
import { createGitHubAuthController } from './github/controller.ts'
import { createGoogleAuthController } from './google/controller.ts'
import { login } from './login-action.ts'
import { logout } from './logout-action.ts'
import { resetPasswordController } from './reset-password/controller.tsx'
import { signupController } from './signup/controller.tsx'
import { createXAuthController } from './x/controller.ts'
import type { AppContext } from '../../router.ts'
import type { routes } from '../../routes.ts'
import {
  externalProviderRegistry,
  type ExternalProviderRegistry,
} from '../../utils/external-auth.ts'

export function createAuthController(
  registry: ExternalProviderRegistry = externalProviderRegistry,
) {
  return {
    actions: {
      login,
      logout,
      signup: signupController,
      forgotPassword: forgotPasswordController,
      resetPassword: resetPasswordController,
      google: createGoogleAuthController(registry),
      github: createGitHubAuthController(registry),
      x: createXAuthController(registry),
    },
  } satisfies Controller<typeof routes.auth, AppContext>
}
