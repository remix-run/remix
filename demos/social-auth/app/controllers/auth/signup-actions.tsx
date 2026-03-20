import type { Controller } from 'remix/fetch-router'
import * as s from 'remix/data-schema'
import { Database } from 'remix/data-table'
import { redirect } from 'remix/response/redirect'

import { normalizeEmail, normalizeText, users } from '../../../data/schema.ts'
import { getIssueMessage, readSignupValues } from './form-utils.ts'
import { SignupPage } from './signup-page.tsx'
import { signupSchema } from './schemas.ts'
import { writeAuthenticatedSession } from '../../models/auth-session.ts'
import { getPostAuthRedirect, getReturnToQuery } from '../../middleware/auth.ts'
import { hashPassword } from '../../models/password-hash.ts'
import { routes } from '../../routes.ts'
import { render } from '../render.tsx'
import { Session } from '../../middleware/session.ts'

export let signupActions = {
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
      writeAuthenticatedSession(session, {
        userId: user.id,
        loginMethod: 'credentials',
      })

      return redirect(getPostAuthRedirect(context.url))
    },
  },
} satisfies Controller<typeof routes.auth.signup>
