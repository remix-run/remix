import type { Controller } from 'remix/fetch-router'
import { Database } from 'remix/data-table'
import * as s from 'remix/data-schema'
import { redirect } from 'remix/response/redirect'

import { SignupPage } from './page.tsx'
import { getIssueMessage, readSignupValues } from '../form-utils.ts'
import { signupSchema } from '../schemas.ts'
import { normalizeEmail, normalizeText, users } from '../../../data/schema.ts'
import { getPostAuthRedirect, getReturnToQuery } from '../../../middleware/auth.ts'
import { Session } from '../../../middleware/session.ts'
import type { AppContext } from '../../../router.ts'
import { routes } from '../../../routes.ts'
import { hashPassword } from '../../../utils/password-hash.ts'
import { render } from '../../../utils/render.tsx'

export const signupController = {
  actions: {
    index(context) {
      return render(
        <SignupPage
          formAction={routes.auth.signup.action.href(undefined, getReturnToQuery(context.url))}
          loginHref={routes.home.href(undefined, getReturnToQuery(context.url))}
        />,
      )
    },

    async action(context) {
      let db = context.get(Database)
      let result = s.parseSafe(signupSchema, context.get(FormData))
      if (!result.success) {
        return render(
          <SignupPage
            formAction={routes.auth.signup.action.href(undefined, getReturnToQuery(context.url))}
            loginHref={routes.home.href(undefined, getReturnToQuery(context.url))}
            error={getIssueMessage(result.issues)}
            values={readSignupValues(context.get(FormData))}
          />,
          { status: 400 },
        )
      }

      let signup = result.value
      let name = normalizeText(signup.name)
      let emailAddress = normalizeEmail(signup.email)
      let existingUser = await db.findOne(users, { where: { email: emailAddress } })

      if (existingUser != null) {
        return render(
          <SignupPage
            formAction={routes.auth.signup.action.href(undefined, getReturnToQuery(context.url))}
            loginHref={routes.home.href(undefined, getReturnToQuery(context.url))}
            error="An account with that email already exists."
            values={{ name, email: emailAddress }}
          />,
          { status: 400 },
        )
      }

      let user = await db.create(
        users,
        {
          email: emailAddress,
          password_hash: await hashPassword(signup.password),
          name,
        },
        { returnRow: true },
      )

      let session = context.get(Session)
      session.regenerateId(true)
      session.set('auth', {
        userId: user.id,
        loginMethod: 'credentials',
      })

      return redirect(getPostAuthRedirect(context.url))
    },
  },
} satisfies Controller<typeof routes.auth.signup, AppContext>
