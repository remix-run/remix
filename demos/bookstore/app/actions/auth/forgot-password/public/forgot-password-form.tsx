import * as form from '@remix-run/ui/form'
import type { FormSubmission } from 'remix/data-schema/form'
import { clientEntry } from 'remix/component'
import type { Handle } from 'remix/component'

import { routes } from '../../../../routes.ts'
import { Field } from '../../../../ui/public/field.tsx'
import { ForgotPasswordForm } from '../../schemas.ts'

export const ForgotPasswordFields = clientEntry(
  import.meta.url,
  function ForgotPasswordFields(handle: Handle<{ submission?: FormSubmission }>) {
    return () => (
      <form.Context id={handle.id} schema={ForgotPasswordForm} submission={handle.props.submission}>
        {({ fields, errors }) => (
          <form method="POST" action={routes.auth.forgotPassword.action.href()} mix={form.root()}>
            {errors.form && <p role="alert">{errors.form.join(' ')}</p>}
            <Field
              field={fields.email}
              label="Email"
              type="email"
              input={{ autoComplete: 'email' }}
            />
            <button type="submit" class="btn">
              Send Reset Link
            </button>
          </form>
        )}
      </form.Context>
    )
  },
)
