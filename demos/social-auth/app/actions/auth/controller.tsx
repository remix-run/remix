import { createController } from 'remix/fetch-router'
import { completeAuth, verifyCredentials } from 'remix/auth'
import { redirect } from 'remix/response/redirect'

import { getPostAuthRedirect, getReturnToQuery, passwordProvider } from '../../middleware/auth.ts'
import { Session } from '../../middleware/session.ts'
import { routes } from '../../routes.ts'

export function createAuthController() {
  return createController(routes.auth, {
    actions: {
      async login(context) {
        let { get, url } = context

        try {
          let user = await verifyCredentials(passwordProvider, context)

          if (user == null) {
            let session = get(Session)
            session.flash('error', 'Invalid email or password. Please try again.')
            return redirect(routes.home.href(undefined, getReturnToQuery(url)))
          }

          let session = completeAuth(context)
          session.set('auth', {
            userId: user.id,
            loginMethod: 'credentials',
          })

          return redirect(getPostAuthRedirect(url))
        } catch {
          let session = get(Session)
          session.flash('error', 'We could not complete that sign-in request.')
          return redirect(routes.home.href(undefined, getReturnToQuery(url)))
        }
      },

      logout({ get }) {
        let session = get(Session)
        session.unset('auth')
        session.regenerateId(true)
        return redirect(routes.home.href())
      },
    },
  })
}
