import { sendEmailOTP } from 'remix/auth'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { getResendMessage } from '../email-sign-in.ts'
import { readField } from '../form-utils.ts'
import { EmailCodePage } from './page.tsx'
import { normalizeEmail } from '../../../data/schema.ts'
import { getReturnToHrefOptions } from '../../../middleware/auth.ts'
import { routes } from '../../../routes.ts'
import { emailOTPProvider } from '../../../utils/email-auth.ts'

export const emailCodeController = createController(routes.auth.emailCode, {
  actions: {
    index({ render, url }) {
      let returnToHrefOptions = getReturnToHrefOptions(url)

      return render(
        <EmailCodePage
          formAction={routes.auth.emailCode.action.href(undefined, returnToHrefOptions)}
          loginHref={routes.home.href(undefined, returnToHrefOptions)}
        />,
      )
    },

    async action(context) {
      let { formData, render, session, url } = context
      let returnToHrefOptions = getReturnToHrefOptions(url)
      let email = readField(formData, 'email') ?? ''
      let result = await sendEmailOTP(emailOTPProvider, context, { email })

      if (result.status === 'failure' && result.code === 'invalid_email') {
        return render(
          <EmailCodePage
            formAction={routes.auth.emailCode.action.href(undefined, returnToHrefOptions)}
            loginHref={routes.home.href(undefined, returnToHrefOptions)}
            error="Enter a valid email address."
            email={email}
          />,
          { status: 400 },
        )
      }

      // A rate-limited request still has a recent code on its way, so both outcomes continue to
      // the code form.
      session.set('emailCodeAddress', normalizeEmail(email))

      if (result.status === 'failure') {
        session.flash('error', getResendMessage('code', result.retryAfter))
      }

      return redirect(routes.auth.emailCodeVerify.index.href(undefined, returnToHrefOptions))
    },
  },
})
