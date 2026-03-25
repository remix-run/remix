import type { Controller } from 'remix/fetch-router'
import { completeAuth, verifyCredentials } from 'remix/auth'
import { redirect } from 'remix/response/redirect'

import { Session } from '../../../middleware/session.ts'
import { routes } from '../../../routes.ts'
import { render } from '../../../utils/render.tsx'
import {
  getLoginRedirectURL,
  getPostAuthRedirect,
  passwordProvider,
} from '../../../middleware/auth.ts'
import { LoginPage } from './page.tsx'

export default {
  actions: {
    index({ get, url }) {
      let session = get(Session)
      let error = session.get('error')
      let formAction = getLoginRedirectURL(url, routes.auth.login.action)

      return render(
        <LoginPage error={typeof error === 'string' ? error : undefined} formAction={formAction} />,
      )
    },

    async action(context) {
      let user = await verifyCredentials(passwordProvider, context)

      if (user == null) {
        let session = context.get(Session)
        session.flash('error', 'Invalid email or password. Please try again.')
        return redirect(getLoginRedirectURL(context.url))
      }

      let session = completeAuth(context)
      session.set('auth', { userId: user.id })

      return redirect(getPostAuthRedirect(context.url))
    },
  },
} satisfies Controller<typeof routes.auth.login>
