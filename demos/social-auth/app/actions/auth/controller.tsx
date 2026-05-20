import { createController } from 'remix/router'
import { completeAuth, verifyCredentials } from 'remix/auth'
import { redirect } from 'remix/response/redirect'

import { getPostAuthRedirect, getReturnToQuery, passwordProvider } from '../../middleware/auth.ts'
import { routes } from '../../routes.ts'

export function createAuthController() {
  return createController(routes.auth, {
    actions: {
      async login(context) {
        let { session, url } = context

        try {
          let user = await verifyCredentials(passwordProvider, context)

          if (user == null) {
            session.flash('error', 'Invalid email or password. Please try again.')
            return redirect(routes.home.href(undefined, getReturnToQuery(url)))
          }

          let authSession = completeAuth(context)
          authSession.set('auth', {
            userId: user.id,
            loginMethod: 'credentials',
          })

          return redirect(getPostAuthRedirect(url))
        } catch {
          session.flash('error', 'We could not complete that sign-in request.')
          return redirect(routes.home.href(undefined, getReturnToQuery(url)))
        }
      },

      logout({ session }) {
        session.unset('auth')
        session.regenerateId(true)
        return redirect(routes.home.href())
      },
    },
  })
}
