import type { Controller } from 'remix/fetch-router'
import { css } from 'remix/component'
import * as s from 'remix/data-schema'
import { Database } from 'remix/data-table'
import { redirect } from 'remix/response/redirect'

import { routes } from '../../routes.ts'
import { passwordResetTokens, users } from '../../data/schema.ts'
import { Document } from '../../layout.tsx'
import { render } from '../../utils/render.ts'
import { Session } from '../../utils/session.ts'
import { authCardStyle, resetPasswordSchema } from '../shared.ts'

let resetPasswordController = {
  actions: {
    index({ params, get }) {
      let session = get(Session)
      let token = params.token
      let error = session.get('error')

      return render(
        <Document>
          <div class="card" mix={[authCardStyle]}>
            <h1>Reset Password</h1>
            <p>Enter your new password below.</p>

            {typeof error === 'string' ? (
              <div class="alert alert-error" mix={[css({ marginBottom: '1.5rem' })]}>
                {error}
              </div>
            ) : null}

            <form method="POST" action={routes.auth.resetPassword.action.href({ token })}>
              <div class="form-group">
                <label for="password">New Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  required
                  autoComplete="new-password"
                />
              </div>

              <div class="form-group">
                <label for="confirmPassword">Confirm Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  required
                  autoComplete="new-password"
                />
              </div>

              <button type="submit" class="btn">
                Reset Password
              </button>
            </form>
          </div>
        </Document>,
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

      await db.update(users, user.id, { password })
      await db.delete(passwordResetTokens, { token })

      return render(
        <Document>
          <div class="card" mix={[authCardStyle]}>
            <div class="alert alert-success">
              Password reset successfully! You can now login with your new password.
            </div>
            <p>
              <a href={routes.auth.login.index.href()} class="btn">
                Login
              </a>
            </p>
          </div>
        </Document>,
      )
    },
  },
} satisfies Controller<typeof routes.auth.resetPassword>

export default resetPasswordController
