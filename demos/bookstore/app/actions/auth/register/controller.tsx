import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { users } from '../../../data/schema.ts'
import { routes } from '../../../routes.ts'
import { hashPassword } from '../../../utils/password-hash.ts'
import { browsingResponseInit } from '../../browsing-response.ts'
import { normalizeEmail, RegistrationForm } from '../schemas.ts'
import { ExistingAccountPage, RegisterPage } from './page.tsx'

export default createController(routes.auth.register, {
  actions: {
    index({ render, request }) {
      return render(<RegisterPage />, browsingResponseInit(request))
    },

    async action({ db, formData, render, session }) {
      let submission = RegistrationForm.parseSafe(formData)
      if (!submission.success) {
        return render(<RegisterPage submission={submission} />, { status: 400 })
      }
      let { email, name, password } = submission.value
      let normalizedEmail = normalizeEmail(email)

      if (await db.findOne(users, { where: { email: normalizedEmail } })) {
        return render(<ExistingAccountPage />, { status: 400 })
      }

      let user = await db.create(
        users,
        {
          email: normalizedEmail,
          password_hash: await hashPassword(password),
          name,
        },
        { returnRow: true },
      )

      session.regenerateId(true)
      session.set('auth', { userId: user.id })

      return redirect(routes.account.index.href())
    },
  },
})
