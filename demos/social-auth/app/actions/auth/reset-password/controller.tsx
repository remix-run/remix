import { createController } from 'remix/router'
import type { Database } from 'remix/data-table'
import * as s from 'remix/data-schema'

import { ErrorPage } from '../error-page.tsx'
import { getIssueMessage } from '../form-utils.ts'
import { ResetPasswordCompletePage, ResetPasswordPage } from './page.tsx'
import { resetPasswordSchema } from '../schemas.ts'
import { passwordResetTokens, users } from '../../../data/schema.ts'
import { getReturnToQuery } from '../../../middleware/auth.ts'
import { routes } from '../../../routes.ts'
import { hashPassword } from '../../../utils/password-hash.ts'

async function loadResetToken(db: Database, token: string) {
  let resetToken = await db.find(passwordResetTokens, { token })
  if (resetToken == null) {
    return null
  }

  if (resetToken.expires_at <= Date.now()) {
    await db.delete(passwordResetTokens, { token })
    return null
  }

  return resetToken
}

export const resetPasswordController = createController(routes.auth.resetPassword, {
  actions: {
    async index(context) {
      let { db, params, render, url } = context
      let returnToQuery = getReturnToQuery(url)
      let resetToken = await loadResetToken(db, params.token)

      if (resetToken == null) {
        return render(
          <ErrorPage
            title="Reset Link Expired"
            message="That password reset link is missing or has expired."
            loginHref={routes.home.href(undefined, returnToQuery)}
          />,
          { status: 400 },
        )
      }

      return render(
        <ResetPasswordPage
          formAction={routes.auth.resetPassword.action.href({ token: params.token }, returnToQuery)}
          loginHref={routes.home.href(undefined, returnToQuery)}
        />,
      )
    },

    async action(context) {
      let { db, formData, params, render, session, url } = context
      let returnToQuery = getReturnToQuery(url)
      let resetToken = await loadResetToken(db, params.token)

      if (resetToken == null) {
        return render(
          <ErrorPage
            title="Reset Link Expired"
            message="That password reset link is missing or has expired."
            loginHref={routes.home.href(undefined, returnToQuery)}
          />,
          { status: 400 },
        )
      }

      let result = s.parseSafe(resetPasswordSchema, formData)
      if (!result.success) {
        return render(
          <ResetPasswordPage
            formAction={routes.auth.resetPassword.action.href(
              { token: params.token },
              returnToQuery,
            )}
            loginHref={routes.home.href(undefined, returnToQuery)}
            error={getIssueMessage(result.issues)}
          />,
          { status: 400 },
        )
      }

      let resetPassword = result.value
      if (resetPassword.password !== resetPassword.confirmPassword) {
        return render(
          <ResetPasswordPage
            formAction={routes.auth.resetPassword.action.href(
              { token: params.token },
              returnToQuery,
            )}
            loginHref={routes.home.href(undefined, returnToQuery)}
            error="Passwords must match."
          />,
          { status: 400 },
        )
      }

      let user = await db.find(users, resetToken.user_id)
      if (user == null) {
        await db.delete(passwordResetTokens, { token: resetToken.token })
        return render(
          <ErrorPage
            title="Account Not Found"
            message="The account for that reset link no longer exists."
            loginHref={routes.home.href(undefined, returnToQuery)}
          />,
          { status: 400 },
        )
      }

      await db.update(users, user.id, {
        password_hash: await hashPassword(resetPassword.password),
      })
      await db.delete(passwordResetTokens, { token: resetToken.token })

      session.flash('success', 'Password updated. You can sign in now.')

      return render(
        <ResetPasswordCompletePage loginHref={routes.home.href(undefined, returnToQuery)} />,
      )
    },
  },
})
