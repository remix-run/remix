import type { Controller } from 'remix/fetch-router'

import { login } from './login-action.ts'
import { logout } from './logout-action.ts'
import type { AppContext } from '../../router.ts'
import type { routes } from '../../routes.ts'

export function createAuthController() {
  return {
    actions: {
      login,
      logout,
    },
  } satisfies Controller<typeof routes.auth, AppContext>
}
