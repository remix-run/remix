import { createController } from 'remix/router'
import * as s from 'remix/data-schema'
import { redirect } from 'remix/response/redirect'

import { passwordResetTokens, users } from '../../../data/schema.ts'
import { routes } from '../../../routes.ts'
import { hashPassword } from '../../../utils/password-hash.ts'
import { resetPasswordSchema } from '../schemas.ts'
import { ResetPasswordPage, ResetPasswordSuccessPage } from './page.tsx'

export default createController(routes.auth.resetPassword, {
  actions: {
    index({ params, render, session }) {
      let token = params.token
      let error = session.get('error')

      return render(
        <ResetPasswordPage error={typeof error === 'string' ? error : undefined} token={token} />,
      )
    },

    async action({ db, formData, params, render, session }) {
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
})
