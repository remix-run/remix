import type { Controller } from 'remix/fetch-router'
import * as s from 'remix/data-schema'
import { Database } from 'remix/data-table'
import { redirect } from 'remix/response/redirect'

import { users } from '../../../data/schema.ts'
import { Session } from '../../../middleware/session.ts'
import { routes } from '../../../routes.ts'
import { hashPassword } from '../../../utils/password-hash.ts'
import { render } from '../../render.tsx'
import { normalizeEmail, registrationSchema } from '../schemas.ts'
import { ExistingAccountPage, RegisterPage } from './page.tsx'

export default {
  actions: {
    index() {
      return render(<RegisterPage />)
    },

    async action({ get }) {
      let db = get(Database)
      let session = get(Session)
      let formData = get(FormData)
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
} satisfies Controller<typeof routes.auth.register>
