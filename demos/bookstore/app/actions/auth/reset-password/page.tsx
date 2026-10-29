import type { Handle } from 'remix/component'
import type { FormSubmission } from 'remix/data-schema/form'

import { routes } from '../../../routes.ts'
import { Document } from '../../../ui/document.tsx'
import { authCardStyle } from '../schemas.ts'
import { ResetPasswordFields } from './public/reset-password-form.tsx'

export interface ResetPasswordPageProps {
  token: string
  error?: string
  submission?: FormSubmission
}

export function ResetPasswordPage(handle: Handle<ResetPasswordPageProps>) {
  return () => {
    let { error, token } = handle.props

    return (
      <Document>
        <div class="card" mix={authCardStyle}>
          <h1>Reset Password</h1>
          <p>Enter your new password below.</p>

          <ResetPasswordFields
            token={token}
            submission={
              handle.props.submission ??
              (error ? { values: {}, errors: { fields: {}, form: [error] } } : undefined)
            }
          />
        </div>
      </Document>
    )
  }
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
