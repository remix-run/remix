import { createController } from 'remix/fetch-router'
import * as s from 'remix/data-schema'
import { redirect } from 'remix/response/redirect'

import { SignupPage } from './page.tsx'
import { getIssueMessage, readSignupValues } from '../form-utils.ts'
import { signupSchema } from '../schemas.ts'
import { normalizeEmail, normalizeText, users } from '../../../data/schema.ts'
import { getPostAuthRedirect, getReturnToQuery } from '../../../middleware/auth.ts'
import { routes } from '../../../routes.ts'
import { hashPassword } from '../../../utils/password-hash.ts'

export const signupController = createController(routes.auth.signup, {
  actions: {
    index({ render, url }) {
      let returnToQuery = getReturnToQuery(url)

      return render(
        <SignupPage
          formAction={routes.auth.signup.action.href(undefined, returnToQuery)}
          loginHref={routes.home.href(undefined, returnToQuery)}
        />,
      )
    },

    async action({ db, formData, render, session, url }) {
      let returnToQuery = getReturnToQuery(url)
      let result = s.parseSafe(signupSchema, formData)

      if (!result.success) {
        return render(
          <SignupPage
            formAction={routes.auth.signup.action.href(undefined, returnToQuery)}
            loginHref={routes.home.href(undefined, returnToQuery)}
            error={getIssueMessage(result.issues)}
            values={readSignupValues(formData)}
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
            formAction={routes.auth.signup.action.href(undefined, returnToQuery)}
            loginHref={routes.home.href(undefined, returnToQuery)}
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

      session.regenerateId(true)
      session.set('auth', {
        userId: user.id,
        loginMethod: 'credentials',
      })

      return redirect(getPostAuthRedirect(url))
    },
  },
})
