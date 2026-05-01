import type { Controller } from 'remix/fetch-router'
import * as s from 'remix/data-schema'
import { Database } from 'remix/data-table'
import { redirect } from 'remix/response/redirect'

import { passwordResetTokens, users } from '../../../data/schema.ts'
import { Session } from '../../../middleware/session.ts'
import { routes } from '../../../routes.ts'
import { hashPassword } from '../../../utils/password-hash.ts'
import { render } from '../../../utils/render.tsx'
import { resetPasswordSchema } from '../schemas.ts'
import { ResetPasswordPage, ResetPasswordSuccessPage } from './page.tsx'

export default {
  actions: {
    index({ params, get }) {
      let session = get(Session)
      let token = params.token
      let error = session.get('error')

      return render(
        <ResetPasswordPage error={typeof error === 'string' ? error : undefined} token={token} />,
      )
    },

    async action({ get, params }) {
      let db = get(Database)
      let session = get(Session)
      let formData = get(FormData)
      let { confirmPassword, password } = s.parse(resetPasswordSchema, formData)
      let token = params.token

      if (!token) {
        session.flash('error', 'Invalid or expired reset token.')
        return redirect(routes.auth.forgotPassword.index.href())
      }

      if (password !== confirmPassword) {
        session.flash('error', 'Passwords do not match.')
        return redirect(routes.auth.resetPassword.index.href({ token }))
      }

      let tokenData = await db.find(passwordResetTokens, { token })

      if (!tokenData || tokenData.expires_at < Date.now()) {
        session.flash('error', 'Invalid or expired reset token.')
        return redirect(routes.auth.resetPassword.index.href({ token }))
      }

      let user = await db.find(users, tokenData.user_id)
      if (!user) {
        session.flash('error', 'Invalid or expired reset token.')
        return redirect(routes.auth.resetPassword.index.href({ token }))
      }

      await db.update(users, user.id, { password_hash: await hashPassword(password) })
      await db.delete(passwordResetTokens, { token })

      return render(<ResetPasswordSuccessPage />)
    },
  },
} satisfies Controller<typeof routes.auth.resetPassword>
