import { createController } from 'remix/fetch-router'
import * as s from 'remix/data-schema'

import { ForgotPasswordPage, ForgotPasswordSentPage } from './page.tsx'
import { getIssueMessage, readField } from '../form-utils.ts'
import { forgotPasswordSchema } from '../schemas.ts'
import { normalizeEmail, passwordResetTokens, users } from '../../../data/schema.ts'
import { getReturnToQuery } from '../../../middleware/auth.ts'
import { routes } from '../../../routes.ts'

export const forgotPasswordController = createController(routes.auth.forgotPassword, {
  actions: {
    index({ render, url }) {
      return render(
        <ForgotPasswordPage
          formAction={routes.auth.forgotPassword.action.href(undefined, getReturnToQuery(url))}
          loginHref={routes.home.href(undefined, getReturnToQuery(url))}
        />,
      )
    },

    async action({ db, formData, render, url }) {
      let returnToQuery = getReturnToQuery(url)
      let result = s.parseSafe(forgotPasswordSchema, formData)

      if (!result.success) {
        return render(
          <ForgotPasswordPage
            formAction={routes.auth.forgotPassword.action.href(undefined, returnToQuery)}
            loginHref={routes.home.href(undefined, returnToQuery)}
            error={getIssueMessage(result.issues)}
            email={readField(formData, 'email')}
          />,
          { status: 400 },
        )
      }

      let forgotPassword = result.value
      let emailAddress = normalizeEmail(forgotPassword.email)
      let user = await db.findOne(users, { where: { email: emailAddress } })
      let resetHref: string | undefined

      if (user != null) {
        let token = crypto.randomUUID().replaceAll('-', '')
        await db.create(passwordResetTokens, {
          token,
          user_id: user.id,
          expires_at: Date.now() + 1000 * 60 * 60,
        })
        resetHref = new URL(routes.auth.resetPassword.index.href({ token }), url.origin).toString()
      }

      return render(
        <ForgotPasswordSentPage
          email={emailAddress}
          loginHref={routes.home.href(undefined, returnToQuery)}
          resetHref={resetHref}
        />,
      )
    },
  },
})
