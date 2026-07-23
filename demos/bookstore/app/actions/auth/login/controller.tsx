import { createController } from 'remix/router'
import { completeAuth, verifyCredentials } from 'remix/auth'
import type { FormSubmission } from 'remix/data-schema/form'
import { redirect } from 'remix/response/redirect'

import { routes } from '../../../routes.ts'
import {
  getLoginRedirectURL,
  getPostAuthRedirect,
  passwordProvider,
} from '../../../middleware/auth.ts'
import { LoginForm } from './login-form.ts'
import { LoginPage } from './page.tsx'

const invalidCredentialsMessage = 'Invalid email or password. Please try again.'

export default createController(routes.auth.login, {
  actions: {
    index({ render, url }) {
      let formAction = getLoginRedirectURL(url, routes.auth.login.action)

      return render(<LoginPage formAction={formAction} />)
    },

    async action(context) {
      let { formData, render, url } = context
      let formAction = getLoginRedirectURL(url, routes.auth.login.action)
      let submission = LoginForm.parse(formData)

      if (!submission.success) {
        return render(<LoginPage formAction={formAction} submission={submission} />, { status: 400 })
      }

      let user = await verifyCredentials(passwordProvider, context)

      if (user == null) {
        let failure: FormSubmission = {
          values: { email: submission.value.email },
          errors: { fields: {}, form: [invalidCredentialsMessage] },
        }

        return render(<LoginPage formAction={formAction} submission={failure} />, { status: 400 })
      }

      let authSession = completeAuth(context)
      authSession.set('auth', { userId: user.id })

      return redirect(getPostAuthRedirect(url))
    },
  },
})
