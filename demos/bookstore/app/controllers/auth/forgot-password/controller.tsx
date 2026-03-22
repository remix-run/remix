import type { Controller } from 'remix/fetch-router'
import * as s from 'remix/data-schema'
import { Database, query } from 'remix/data-table'

import { passwordResetTokens, users } from '../../../data/schema.ts'
import type { routes } from '../../../routes.ts'
import { render } from '../../render.tsx'
import { forgotPasswordSchema, normalizeEmail } from '../schemas.ts'
import { ForgotPasswordPage, ForgotPasswordSuccessPage } from './page.tsx'

let forgotPasswordController = {
  actions: {
    index() {
      return render(<ForgotPasswordPage />)
    },

    async action({ get }) {
      let db = get(Database)
      let formData = get(FormData)
      let { email } = s.parse(forgotPasswordSchema, formData)
      let normalizedEmail = normalizeEmail(email)
      let user = await db.exec(query(users).where({ email: normalizedEmail }).first())
      let token = undefined as string | undefined

      if (user) {
        token = Math.random().toString(36).substring(2, 15)
        await db.exec(
          query(passwordResetTokens).insert({
            token,
            user_id: user.id,
            expires_at: Date.now() + 3600000,
          }),
        )
      }

      return render(<ForgotPasswordSuccessPage token={token} />)
    },
  },
} satisfies Controller<typeof routes.auth.forgotPassword>

export default forgotPasswordController
