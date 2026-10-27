import type { FormSubmission } from 'remix/data-schema/form'
import { clientEntry, css } from 'remix/component'
import type { Handle } from 'remix/component'
import * as form from '@remix-run/ui/form'

import { LoginForm } from '../../auth/login/login-form.ts'

export const LoginFields = clientEntry(
  import.meta.url,
  function LoginFields(handle: Handle<{ formAction: string; submission?: LoginSubmission }>) {
    return () => {
      let { formAction, submission } = handle.props

      return (
        <form.Context id={handle.id} schema={LoginForm} submission={submission}>
          {({ fields, errors }) => (
            <>
              {errors.form.length > 0 ? (
                <div class="alert alert-error" role="alert" mix={css({ marginBottom: '1.5rem' })}>
                  {errors.form.join(' ')}
                </div>
              ) : null}

              <form method="POST" action={formAction} mix={form.root()}>
                <div class="form-group">
                  <label mix={form.label(fields.email)}>Email</label>
                  <input type="email" autoComplete="email" mix={form.control(fields.email)} />
                  {fields.email.errors.length > 0 ? (
                    <p mix={form.error(fields.email)} role="alert">
                      {fields.email.errors.join(' ')}
                    </p>
                  ) : null}
                </div>

                <div class="form-group">
                  <label mix={form.label(fields.password)}>Password</label>
                  <input autoComplete="current-password" mix={form.control(fields.password)} />
                  {fields.password.errors.length > 0 ? (
                    <p mix={form.error(fields.password)} role="alert">
                      {fields.password.errors.join(' ')}
                    </p>
                  ) : null}
                </div>

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
