import type { Controller } from 'remix/fetch-router'
import { redirect } from 'remix/response/redirect'

import { Session } from '../../middleware/session.ts'
import { routes } from '../../routes.ts'
import forgotPasswordController from './forgot-password/controller.tsx'
import loginController from './login/controller.tsx'
import registerController from './register/controller.tsx'
import resetPasswordController from './reset-password/controller.tsx'

export default {
  actions: {
    login: loginController,
    register: registerController,
    logout({ get }) {
      let session = get(Session)
      session.unset('auth')
      session.regenerateId(true)
      return redirect(routes.home.href())
    },
    forgotPassword: forgotPasswordController,
    resetPassword: resetPasswordController,
  },
} satisfies Controller<typeof routes.auth>
