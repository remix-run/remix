import { css } from 'remix/component'

import { routes } from '../../../routes.ts'
import { Document } from '../../../ui/document.tsx'
import { authCardStyle } from '../schemas.ts'

export interface ResetPasswordPageProps {
  token: string
  error?: string
}

export function ResetPasswordPage() {
  return ({ error, token }: ResetPasswordPageProps) => (
    <Document>
      <div class="card" mix={authCardStyle}>
        <h1>Reset Password</h1>
        <p>Enter your new password below.</p>

        {typeof error === 'string' ? (
          <div class="alert alert-error" mix={css({ marginBottom: '1.5rem' })}>
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
    </Document>
  )
}

export function ResetPasswordSuccessPage() {
  return () => (
    <Document>
      <div class="card" mix={authCardStyle}>
        <div class="alert alert-success">
          Password reset successfully! You can now login with your new password.
        </div>
        <p>
          <a href={routes.auth.login.index.href()} class="btn">
            Login
          </a>
        </p>
      </div>
    </Document>
  )
}
