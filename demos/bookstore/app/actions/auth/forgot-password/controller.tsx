import { createController } from 'remix/fetch-router'
import * as s from 'remix/data-schema'
import { Database } from 'remix/data-table'

import { passwordResetTokens, users } from '../../../data/schema.ts'
import { routes } from '../../../routes.ts'
import { render } from '../../render.tsx'
import { forgotPasswordSchema, normalizeEmail } from '../schemas.ts'
import { ForgotPasswordPage, ForgotPasswordSuccessPage } from './page.tsx'

export default createController(routes.auth.forgotPassword, {
  actions: {
    index() {
      return render(<ForgotPasswordPage />)
    },

    async action({ get }) {
      let db = get(Database)
      let formData = get(FormData)
      let { email } = s.parse(forgotPasswordSchema, formData)
      let normalizedEmail = normalizeEmail(email)
      let user = await db.findOne(users, { where: { email: normalizedEmail } })
      let token = undefined as string | undefined

      if (user) {
        token = Math.random().toString(36).substring(2, 15)
        await db.create(passwordResetTokens, {
          token,
          user_id: user.id,
          expires_at: Date.now() + 3600000,
        })
      }

      return render(<ForgotPasswordSuccessPage token={token} />)
    },
  },
})
