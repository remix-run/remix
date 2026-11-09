import { sendMagicLink } from 'remix/auth'
import { createController } from 'remix/router'

import { getResendMessage } from '../email-sign-in.ts'
import { readField } from '../form-utils.ts'
import { MagicLinkPage, MagicLinkSentPage } from './page.tsx'
import { normalizeEmail } from '../../../data/schema.ts'
import { getReturnToHrefOptions } from '../../../middleware/auth.ts'
import { routes } from '../../../routes.ts'
import { magicLinkProvider } from '../../../utils/email-auth.ts'
import { readLatestOutboxEmail } from '../../../utils/email-outbox.ts'

export const magicLinkController = createController(routes.auth.magicLink, {
  actions: {
    index({ render, url }) {
      let returnToHrefOptions = getReturnToHrefOptions(url)

      return render(
        <MagicLinkPage
          formAction={routes.auth.magicLink.action.href(undefined, returnToHrefOptions)}
          loginHref={routes.home.href(undefined, returnToHrefOptions)}
        />,
      )
    },

    async action(context) {
      let { formData, render, url } = context
      let returnToHrefOptions = getReturnToHrefOptions(url)
      let email = readField(formData, 'email') ?? ''
      let result = await sendMagicLink(magicLinkProvider, context, {
        email,
        returnTo: url.searchParams.get('returnTo'),
      })

      if (result.status === 'failure' && result.code === 'invalid_email') {
        return render(
          <MagicLinkPage
            formAction={routes.auth.magicLink.action.href(undefined, returnToHrefOptions)}
            loginHref={routes.home.href(undefined, returnToHrefOptions)}
            error="Enter a valid email address."
            email={email}
          />,
          { status: 400 },
        )
      }

      // Every valid address gets the same page, so it does not reveal which addresses have accounts.
      let emailAddress = normalizeEmail(email)

      return render(
        <MagicLinkSentPage
          email={emailAddress}
          loginHref={routes.home.href(undefined, returnToHrefOptions)}
          notice={
            result.status === 'failure' ? getResendMessage('link', result.retryAfter) : undefined
          }
          outboxEmail={readLatestOutboxEmail(emailAddress)}
        />,
      )
    },
  },
})
