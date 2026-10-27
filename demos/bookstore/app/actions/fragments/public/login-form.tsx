import type { FormSubmission } from 'remix/data-schema/form'
import { clientEntry, css } from 'remix/component'
import type { Handle } from 'remix/component'
import * as form from '@remix-run/ui/form'

import { LoginForm } from '../../auth/login/login-form.ts'
import { Field } from '../../../ui/public/field.tsx'

export const LoginFields = clientEntry(
  import.meta.url,
  function LoginFields(handle: Handle<{ formAction: string; submission?: LoginSubmission }>) {
    return () => {
      let { formAction, submission } = handle.props

      return (
        <form.Context id={handle.id} schema={LoginForm} submission={submission}>
          {({ fields, errors }) => (
            <>
              {errors.form ? (
                <div class="alert alert-error" role="alert" mix={css({ marginBottom: '1.5rem' })}>
                  {errors.form.join(' ')}
                </div>
              ) : null}

              <form method="POST" action={formAction} mix={form.root()}>
                <Field
                  field={fields.email}
                  label="Email"
                  type="email"
                  input={{ autoComplete: 'email' }}
                />
                <Field
                  field={fields.password}
                  label="Password"
                  input={{ autoComplete: 'current-password' }}
                />

                <button type="submit" class="btn">
                  Login
                </button>
              </form>
            </>
          )}
        </form.Context>
      )
    }
  },
)

export type LoginSubmission = FormSubmission
