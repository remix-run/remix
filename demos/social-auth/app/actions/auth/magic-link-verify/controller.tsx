import { completeAuth, verifyMagicLink } from 'remix/auth'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { resolveEmailUser } from '../email-sign-in.ts'
import { ErrorPage } from '../error-page.tsx'
import { MagicLinkConfirmPage } from './page.tsx'
import { routes } from '../../../routes.ts'
import { magicLinkProvider } from '../../../utils/email-auth.ts'

export const magicLinkVerifyController = createController(routes.auth.magicLinkVerify, {
  actions: {
    index({ render }) {
      return render(<MagicLinkConfirmPage loginHref={routes.home.href()} />, {
        headers: {
          // Keep the token in this URL out of Referer headers sent to other origins.
          'Referrer-Policy': 'no-referrer',
        },
      })
    },

    async action(context) {
      let { db, render } = context
      let result = await verifyMagicLink(magicLinkProvider, context)

      if (result.status === 'failure') {
        return render(
          <ErrorPage
            title={result.code === 'expired_token' ? 'Link Expired' : 'Link Not Valid'}
            message={
              result.code === 'expired_token'
                ? 'That sign-in link has expired. Request a new one to continue.'
                : 'That sign-in link was already used or replaced by a newer link.'
            }
            loginHref={routes.auth.magicLink.index.href()}
          />,
          { status: 400 },
        )
      }

      let user = await resolveEmailUser(db, result.email)
      let session = completeAuth(context)
      session.set('auth', {
        userId: user.id,
        loginMethod: 'magic-link',
      })

      return redirect(result.returnTo ?? routes.account.href())
    },
  },
})
