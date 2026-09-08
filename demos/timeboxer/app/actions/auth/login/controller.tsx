import { completeAuth, verifyCredentials } from 'remix/auth'
import * as s from 'remix/data-schema'
import { Auth } from 'remix/middleware/auth'
import { getCsrfToken } from 'remix/middleware/csrf'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'
import { Session } from 'remix/session'

import { credentialsSchema, passwordProvider } from '../../../middleware/auth.ts'
import { routes } from '../../../routes.ts'
import { issuesToErrors } from '../form-errors.ts'
import { LoginPage } from '../pages.tsx'

export const authLogin = createController(routes.auth.login, {
  actions: {
    async index(context) {
      let auth = context.get(Auth)

      if (auth.ok) {
        return redirect(routes.home.index.href())
      }

      let session = context.get(Session)
      let error = session.get('auth:error')

      return context.render(
        <LoginPage csrfToken={getCsrfToken(context)} error={stringOrUndefined(error)} />,
      )
    },

    async action(context) {
      let parsed = s.parseSafe(credentialsSchema, context.get(FormData))

      if (!parsed.success) {
        return context.render(
          <LoginPage csrfToken={getCsrfToken(context)} errors={issuesToErrors(parsed.issues)} />,
          { status: 400 },
        )
      }

      let user = await verifyCredentials(passwordProvider, context)

      if (!user) {
        let session = context.get(Session)
        session.flash('auth:error', 'Invalid username or password.')
        return redirect(routes.auth.login.index.href(), 303)
      }

      let session = completeAuth(context)
      session.set('auth', { userId: user.id })

      return redirect(routes.home.index.href(), 303)
    },
  },
})

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}
