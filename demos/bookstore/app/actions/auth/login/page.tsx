import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import type { FormSubmission } from 'remix/data-schema/form'

import { LoginFields, type LoginSubmission } from '../../../assets/login-form.tsx'
import { routes } from '../../../routes.ts'
import { Document } from '../../../ui/document.tsx'
import { authCardStyle } from '../schemas.ts'

export interface LoginPageProps {
  formAction: string
  submission?: FormSubmission
}

export function LoginPage(handle: Handle<LoginPageProps>) {
  return () => {
    let { formAction, submission } = handle.props

    return (
      <Document>
        <div class="card" mix={authCardStyle}>
          <h1>Login</h1>

          <LoginFields
            formAction={formAction}
            submission={submission ? getLoginSubmission(submission) : undefined}
          />

          <p mix={css({ marginTop: '1.5rem' })}>
            Don't have an account? <a href={routes.auth.register.index.href()}>Register here</a>
          </p>
          <p>
            <a href={routes.auth.forgotPassword.index.href()}>Forgot password?</a>
          </p>

          <div
            mix={css({
              marginTop: '2rem',
              padding: '1rem',
              background: '#f8f9fa',
              borderRadius: '4px',
            })}
          >
            <p mix={css({ fontSize: '0.9rem' })}>
              <strong>Demo Accounts:</strong>
            </p>
            <p mix={css({ fontSize: '0.9rem' })}>Admin: admin@bookstore.com / admin123</p>
            <p mix={css({ fontSize: '0.9rem' })}>Customer: customer@example.com / password123</p>
          </div>
        </div>
      </Document>
    )
  }
}

function getLoginSubmission(submission: FormSubmission): LoginSubmission {
  return {
    values: { ...submission.values },
    errors: {
      fields: Object.fromEntries(
        Object.entries(submission.errors.fields).map(([field, errors]) => [field, [...errors]]),
      ),
      form: [...submission.errors.form],
    },
  }
}
