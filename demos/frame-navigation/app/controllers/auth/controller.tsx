import type { Controller } from 'remix/fetch-router'
import { redirect } from 'remix/response/redirect'

import { routes } from '../../routes.ts'
import loginController from './login/controller.tsx'
import { authCookie } from '../../middleware/auth.ts'

export default {
  actions: {
    login: loginController,
    async logout() {
      return redirect(routes.auth.login.index.href(), {
        headers: {
          'Set-Cookie': await authCookie.serialize('', { maxAge: 0 }),
        },
      })
    },
  },
} satisfies Controller<typeof routes.auth>
