import type { Controller } from 'remix/fetch-router'
import { css } from 'remix/component'
import * as s from 'remix/data-schema'
import { Database } from 'remix/data-table'

import { routes } from '../../routes.ts'
import { passwordResetTokens, users } from '../../data/schema.ts'
import { Document } from '../../layout.tsx'
import { render } from '../../utils/render.ts'
import { authCardStyle, forgotPasswordSchema, normalizeEmail } from '../shared.ts'

let forgotPasswordController = {
  actions: {
    index() {
      return render(
        <Document>
          <div class="card" mix={[authCardStyle]}>
            <h1>Forgot Password</h1>
            <p>Enter your email address and we'll send you a link to reset your password.</p>

            <form method="POST" action={routes.auth.forgotPassword.action.href()}>
              <div class="form-group">
                <label for="email">Email</label>
                <input type="email" id="email" name="email" required autoComplete="email" />
              </div>

              <button type="submit" class="btn">
                Send Reset Link
              </button>
            </form>

            <p mix={[css({ marginTop: '1.5rem' })]}>
              <a href={routes.auth.login.index.href()}>Back to Login</a>
            </p>
          </div>
        </Document>,
      )
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

      return render(
        <Document>
          <div class="card" mix={[authCardStyle]}>
            <div class="alert alert-success">Password reset link sent! Check your email.</div>

            {token ? (
              <div
                mix={[
                  css({
                    marginTop: '1rem',
                    padding: '1rem',
                    background: '#f8f9fa',
                    borderRadius: '4px',
                  }),
                ]}
              >
                <p mix={[css({ fontSize: '0.9rem' })]}>
                  <strong>Demo Mode:</strong> Click the link below to reset your password
                </p>
                <p mix={[css({ marginTop: '0.5rem' })]}>
                  <a
                    href={routes.auth.resetPassword.index.href({ token })}
                    class="btn btn-secondary"
                  >
                    Reset Password
                  </a>
                </p>
              </div>
            ) : null}

            <p mix={[css({ marginTop: '1.5rem' })]}>
              <a href={routes.auth.login.index.href()} class="btn">
                Back to Login
              </a>
            </p>
          </div>
        </Document>,
      )
    },
  },
} satisfies Controller<typeof routes.auth.forgotPassword>

export default forgotPasswordController
