import { createController } from 'remix/router'

import { passwordResetTokens, users } from '../../../data/schema.ts'
import { routes } from '../../../routes.ts'
import { ForgotPasswordForm, normalizeEmail } from '../schemas.ts'
import { ForgotPasswordPage, ForgotPasswordSuccessPage } from './page.tsx'

export default createController(routes.auth.forgotPassword, {
  actions: {
    index({ render }) {
      return render(<ForgotPasswordPage />)
    },

    async action({ db, formData, render }) {
      let submission = ForgotPasswordForm.parseSafe(formData)
      if (!submission.success) {
        return render(<ForgotPasswordPage submission={submission} />, { status: 400 })
      }
      let { email } = submission.value
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
