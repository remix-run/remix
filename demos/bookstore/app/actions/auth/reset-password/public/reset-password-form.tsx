import * as form from '@remix-run/ui/form'
import type { FormSubmission } from 'remix/data-schema/form'
import { clientEntry } from 'remix/component'
import type { Handle } from 'remix/component'

import { routes } from '../../../../routes.ts'
import { Field } from '../../../../ui/public/field.tsx'
import { ResetPasswordForm } from '../../schemas.ts'

export const ResetPasswordFields = clientEntry(
  import.meta.url,
  function ResetPasswordFields(handle: Handle<{ token: string; submission?: FormSubmission }>) {
    return () => (
      <form.Context id={handle.id} schema={ResetPasswordForm} submission={handle.props.submission}>
        {({ fields, errors }) => (
          <form
            method="POST"
            action={routes.auth.resetPassword.action.href({ token: handle.props.token })}
            mix={form.root()}
          >
            {errors.form && (
              <div class="alert alert-error" role="alert">
                {errors.form.join(' ')}
              </div>
            )}
            <Field field={fields.password} label="New Password" autoComplete="new-password" />
            <Field
              field={fields.confirmPassword}
              label="Confirm Password"
              autoComplete="new-password"
            />
            <button type="submit" class="btn">
              Reset Password
            </button>
          </form>
        )}
      </form.Context>
    )
  },
)
