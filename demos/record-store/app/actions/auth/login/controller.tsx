import { createController } from 'remix/router'
import { completeAuth, verifyCredentials } from 'remix/auth'
import { redirect } from 'remix/response/redirect'

import { routes } from '../../../routes.ts'
import {
  getLoginRedirectURL,
  getPostAuthRedirect,
  passwordProvider,
} from '../../../middleware/auth.ts'
import { LoginPage } from './page.tsx'

export default createController(routes.auth.login, {
  actions: {
    index({ render, session, url }) {
      let error = session.get('error')
      let formAction = getLoginRedirectURL(url, routes.auth.login.action)

      return render(
        <LoginPage error={typeof error === 'string' ? error : undefined} formAction={formAction} />,
      )
    },

    async action(context) {
      let { session, url } = context
      let user = await verifyCredentials(passwordProvider, context)

      if (user == null) {
        session.flash('error', 'Invalid email or password. Please try again.')
        return redirect(getLoginRedirectURL(url))
      }

      let authSession = completeAuth(context)
      authSession.set('auth', { userId: user.id })

      return redirect(getPostAuthRedirect(url))
    },
  },
})
