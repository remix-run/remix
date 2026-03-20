import type { Controller } from 'remix/fetch-router'
import * as s from 'remix/data-schema'
import { Database } from 'remix/data-table'

import { passwordResetTokens, users } from '../../data/schema.ts'
import { ErrorPage } from './error-page.tsx'
import { getIssueMessage } from './form-utils.ts'
import { ResetPasswordCompletePage, ResetPasswordPage } from './reset-password-page.tsx'
import { resetPasswordSchema } from './schemas.ts'
import { flashSuccess, getReturnToQuery } from '../../middleware/auth.ts'
import { hashPassword } from '../../utils/password-hash.ts'
import { routes } from '../../routes.ts'
import { render } from '../render.tsx'
import { Session } from '../../middleware/session.ts'

export let resetPasswordActions = {
  actions: {
    async index(context) {
      let resetToken = await loadResetToken(context, context.params.token)
      if (resetToken == null) {
        return render(
          <ErrorPage
            title="Reset Link Expired"
            message="That password reset link is missing or has expired."
            loginHref={routes.home.href(undefined, getReturnToQuery(context.url))}
          />,
          { status: 400 },
        )
      }

      return render(
        <ResetPasswordPage
          formAction={routes.auth.resetPassword.action.href(
            { token: context.params.token },
            getReturnToQuery(context.url),
          )}
          loginHref={routes.home.href(undefined, getReturnToQuery(context.url))}
        />,
      )
    },

    async action(context) {
      let db = context.get(Database)
      let resetToken = await loadResetToken(context, context.params.token)
      if (resetToken == null) {
        return render(
          <ErrorPage
            title="Reset Link Expired"
            message="That password reset link is missing or has expired."
            loginHref={routes.home.href(undefined, getReturnToQuery(context.url))}
          />,
          { status: 400 },
        )
      }

      let result = s.parseSafe(resetPasswordSchema, context.get(FormData))
      if (!result.success) {
        return render(
          <ResetPasswordPage
            formAction={routes.auth.resetPassword.action.href(
              { token: context.params.token },
              getReturnToQuery(context.url),
            )}
            loginHref={routes.home.href(undefined, getReturnToQuery(context.url))}
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
              { token: context.params.token },
              getReturnToQuery(context.url),
            )}
            loginHref={routes.home.href(undefined, getReturnToQuery(context.url))}
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
            loginHref={routes.home.href(undefined, getReturnToQuery(context.url))}
          />,
          { status: 400 },
        )
      }

      await db.update(users, user.id, {
        password_hash: await hashPassword(resetPassword.password),
      })
      await db.delete(passwordResetTokens, { token: resetToken.token })

      let session = context.get(Session)
      flashSuccess(session, 'Password updated. You can sign in now.')

      return render(
        <ResetPasswordCompletePage
          loginHref={routes.home.href(undefined, getReturnToQuery(context.url))}
        />,
      )
    },
  },
} satisfies Controller<typeof routes.auth.resetPassword>

type ResetPasswordActionContext = Parameters<(typeof resetPasswordActions.actions)['index']>[0]

async function loadResetToken(context: ResetPasswordActionContext, token: string) {
  let db = context.get(Database)
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
