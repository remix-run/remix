import { completeAuth, verifyEmailOTP } from 'remix/auth'
import type { EmailOTPVerifyFailure } from 'remix/auth'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { resolveEmailUser } from '../email-sign-in.ts'
import { readField } from '../form-utils.ts'
import { EmailCodeVerifyPage } from './page.tsx'
import { getPostAuthRedirect, getReturnToHrefOptions } from '../../../middleware/auth.ts'
import { routes } from '../../../routes.ts'
import { emailOTPProvider } from '../../../utils/email-auth.ts'
import { readLatestOutboxEmail } from '../../../utils/email-outbox.ts'

export const emailCodeVerifyController = createController(routes.auth.emailCodeVerify, {
  actions: {
    index({ render, session, url }) {
      let returnToHrefOptions = getReturnToHrefOptions(url)
      let email = session.get('emailCodeAddress')
      let error = session.get('error')

      if (typeof email !== 'string') {
        return redirect(routes.auth.emailCode.index.href(undefined, returnToHrefOptions))
      }

      return render(
        <EmailCodeVerifyPage
          email={email}
          formAction={routes.auth.emailCodeVerify.action.href(undefined, returnToHrefOptions)}
          resendAction={routes.auth.emailCode.action.href(undefined, returnToHrefOptions)}
          loginHref={routes.home.href(undefined, returnToHrefOptions)}
          error={typeof error === 'string' ? error : undefined}
          outboxEmail={readLatestOutboxEmail(email)}
        />,
      )
    },

    async action(context) {
      let { db, formData, render, session, url } = context
      let returnToHrefOptions = getReturnToHrefOptions(url)
      let email = session.get('emailCodeAddress')

      if (typeof email !== 'string') {
        return redirect(routes.auth.emailCode.index.href(undefined, returnToHrefOptions))
      }

      let result = await verifyEmailOTP(emailOTPProvider, context, {
        email,
        code: readField(formData, 'code') ?? '',
      })

      if (result.status === 'failure') {
        return render(
          <EmailCodeVerifyPage
            email={email}
            formAction={routes.auth.emailCodeVerify.action.href(undefined, returnToHrefOptions)}
            resendAction={routes.auth.emailCode.action.href(undefined, returnToHrefOptions)}
            loginHref={routes.home.href(undefined, returnToHrefOptions)}
            error={getCodeErrorMessage(result)}
            outboxEmail={readLatestOutboxEmail(email)}
          />,
          { status: 400 },
        )
      }

      let user = await resolveEmailUser(db, result.email)
      let authSession = completeAuth(context)
      authSession.unset('emailCodeAddress')
      authSession.set('auth', {
        userId: user.id,
        loginMethod: 'email-otp',
      })

      return redirect(getPostAuthRedirect(url))
    },
  },
})

function getCodeErrorMessage(failure: EmailOTPVerifyFailure): string {
  switch (failure.code) {
    case 'invalid_code':
      return failure.attemptsRemaining == null
        ? 'That code is not valid. Request a new code to continue.'
        : `That code is incorrect. ${failure.attemptsRemaining} ${failure.attemptsRemaining === 1 ? 'attempt' : 'attempts'} left.`
    case 'expired_code':
      return 'That code has expired. Request a new code to continue.'
    case 'too_many_attempts':
      return 'Too many incorrect attempts. Request a new code to continue.'
    case 'rate_limited':
      return 'Too many attempts. Please wait a moment and try again.'
  }
}
