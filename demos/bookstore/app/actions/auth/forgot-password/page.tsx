import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import type { FormSubmission } from 'remix/data-schema/form'

import { routes } from '../../../routes.ts'
import { Document } from '../../../ui/document.tsx'
import { authCardStyle } from '../schemas.ts'
import { ForgotPasswordFields } from './public/forgot-password-form.tsx'

export function ForgotPasswordPage(handle: Handle<{ submission?: FormSubmission }>) {
  return () => (
    <Document>
      <div class="card" mix={authCardStyle}>
        <h1>Forgot Password</h1>
        <p>Enter your email address and we'll send you a link to reset your password.</p>

        <ForgotPasswordFields submission={handle.props.submission} />

        <p mix={css({ marginTop: '1.5rem' })}>
          <a href={routes.auth.login.index.href()}>Back to Login</a>
        </p>
      </div>
    </Document>
  )
}

export function ForgotPasswordSuccessPage(handle: Handle<{ token?: string }>) {
  return () => {
    let { token } = handle.props

    return (
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
}
