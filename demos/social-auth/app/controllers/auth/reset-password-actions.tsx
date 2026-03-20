import { Database } from 'remix/data-table'
import * as s from 'remix/data-schema'

import { ErrorPage } from './error-page.tsx'
import { getIssueMessage } from './form-utils.ts'
import { ResetPasswordCompletePage, ResetPasswordPage } from './reset-password-page.tsx'
import { resetPasswordSchema } from './schemas.ts'
import { passwordResetTokens, users } from '../../data/schema.ts'
import { flashSuccess, getReturnToQuery } from '../../middleware/auth.ts'
import { Session } from '../../middleware/session.ts'
import { defineRoutes, type RouteContext } from '../../router.ts'
import { routes } from '../../routes.ts'
import { hashPassword } from '../../utils/password-hash.ts'
import { render } from '../render.tsx'

export let mountResetPasswordRoutes = defineRoutes<{ token: string }>(router => {
  async function loadResetToken(context: RouteContext<{ token: string }>) {
    let db = context.get(Database)
    let token = context.params.token
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

  router.get('/', async context => {
    let resetToken = await loadResetToken(context)
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
  })

  router.post('/', async context => {
    let db = context.get(Database)
    let resetToken = await loadResetToken(context)
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
  })
})
