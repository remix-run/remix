import { css } from 'remix/component'
import type { Handle } from 'remix/component'
import type { FormSubmission } from 'remix/data-schema/form'

import { routes } from '../../../routes.ts'
import { Document } from '../../../ui/document.tsx'
import { authCardStyle } from '../schemas.ts'
import { RegisterFields } from './public/register-form.tsx'

export function RegisterPage(handle: Handle<{ submission?: FormSubmission }>) {
  return () => (
    <Document>
      <div class="card" mix={authCardStyle}>
        <h1>Register</h1>
        <RegisterFields submission={handle.props.submission} />

        <p mix={css({ marginTop: '1.5rem' })}>
          Already have an account? <a href={routes.auth.login.index.href()}>Login here</a>
        </p>
      </div>
    </Document>
  )
}

export function ExistingAccountPage() {
  return () => (
    <Document>
      <div class="card" mix={authCardStyle}>
        <div class="alert alert-error">An account with this email already exists.</div>
        <p>
          <a data-rmx-prefetch="intent" href={routes.auth.register.index.href()} class="btn">
            Back to Register
          </a>
          <a
            href={routes.auth.login.index.href()}
            class="btn btn-secondary"
            mix={css({ marginLeft: '0.5rem' })}
          >
            Login
          </a>
        </p>
      </div>
    </Document>
  )
}
