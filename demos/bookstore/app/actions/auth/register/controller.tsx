import { createController } from 'remix/router'
import * as s from 'remix/data-schema'
import { redirect } from 'remix/response/redirect'

import { users } from '../../../data/schema.ts'
import { routes } from '../../../routes.ts'
import { hashPassword } from '../../../utils/password-hash.ts'
import { normalizeEmail, registrationSchema } from '../schemas.ts'
import { ExistingAccountPage, RegisterPage } from './page.tsx'

export default createController(routes.auth.register, {
  actions: {
    index({ render }) {
      return render(<RegisterPage />)
    },

    async action({ db, formData, render, session }) {
      let { email, name, password } = s.parse(registrationSchema, formData)
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
