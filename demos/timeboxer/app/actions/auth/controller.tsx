import { Auth } from 'remix/middleware/auth'
import { getCsrfToken } from 'remix/middleware/csrf'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'
import { Session } from 'remix/session'

import { routes } from '../../routes.ts'
import { AuthStatusPage } from './pages.tsx'

export const auth = createController(routes.auth, {
  actions: {
    async index(context) {
      let auth = context.get(Auth)

      if (auth.ok) {
        return context.render(
          <AuthStatusPage csrfToken={getCsrfToken(context)} username={auth.identity.username} />,
        )
      }

      return redirect(routes.auth.login.index.href())
    },

    logout(context) {
      let session = context.get(Session)
      session.unset('auth')
      session.regenerateId(true)

      return redirect(routes.auth.login.index.href(), 303)
    },
  },
})
