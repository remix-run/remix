import { css } from 'remix/component'

import { routes } from '../../../routes.ts'
import { Document } from '../../../ui/document.tsx'
import { authCardStyle } from '../schemas.ts'

export function ForgotPasswordPage() {
  return () => (
    <Document>
      <div class="card" mix={authCardStyle}>
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

        <p mix={css({ marginTop: '1.5rem' })}>
          <a href={routes.auth.login.index.href()}>Back to Login</a>
        </p>
      </div>
    </Document>
  )
}

export function ForgotPasswordSuccessPage() {
  return ({ token }: { token?: string }) => (
    <Document>
      <div class="card" mix={authCardStyle}>
        <div class="alert alert-success">Password reset link sent! Check your email.</div>

        {token ? (
          <div
            mix={css({
              marginTop: '1rem',
              padding: '1rem',
              background: '#f8f9fa',
              borderRadius: '4px',
            })}
          >
            <p mix={css({ fontSize: '0.9rem' })}>
              <strong>Demo Mode:</strong> Click the link below to reset your password
            </p>
            <p mix={css({ marginTop: '0.5rem' })}>
              <a href={routes.auth.resetPassword.index.href({ token })} class="btn btn-secondary">
                Reset Password
              </a>
            </p>
          </div>
        ) : null}

        <p mix={css({ marginTop: '1.5rem' })}>
          <a href={routes.auth.login.index.href()} class="btn">
            Back to Login
          </a>
        </p>
      </div>
    </Document>
  )
}
