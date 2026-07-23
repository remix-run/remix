import type { FormRawValue } from 'remix/data-schema/form'
import { clientEntry, css } from 'remix/ui'
import type { Handle } from 'remix/ui'
import { form as formValidation } from 'remix/ui/form'
import input from 'remix/ui/input'

import { LoginForm } from '../actions/auth/login/login-form.ts'

export const LoginFields = clientEntry(
  import.meta.url,
  function LoginFields(handle: Handle<{ formAction: string; submission?: LoginSubmission }>) {
    return () => {
      let { formAction, submission } = handle.props
      let emailErrors = LoginForm.getFieldErrors('email', submission)
      let passwordErrors = LoginForm.getFieldErrors('password', submission)

      return (
        <>
          {submission?.errors.form.length ? (
            <div
              class="alert alert-error"
              role="alert"
              mix={css({ marginBottom: '1.5rem' })}
            >
              {submission.errors.form.join(' ')}
            </div>
          ) : null}

          <form method="POST" action={formAction} mix={formValidation()}>
            <div class="form-group">
              <label {...LoginForm.getLabelAttrs('email')}>{LoginForm.fields.email.label}</label>
              <input
                {...LoginForm.getInputAttrs('email', submission)}
                autoComplete="email"
                mix={input()}
              />
              {emailErrors.length > 0 ? (
                <p {...LoginForm.getErrorAttrs('email')} role="alert">
                  {emailErrors.join(' ')}
                </p>
              ) : null}
            </div>

            <div class="form-group">
              <label {...LoginForm.getLabelAttrs('password')}>
                {LoginForm.fields.password.label}
              </label>
              <input
                {...LoginForm.getInputAttrs('password', submission)}
                autoComplete="current-password"
                mix={input()}
              />
              {passwordErrors.length > 0 ? (
                <p {...LoginForm.getErrorAttrs('password')} role="alert">
                  {passwordErrors.join(' ')}
                </p>
              ) : null}
            </div>

            <button type="submit" class="btn">
              Login
            </button>
          </form>
        </>
      )
    }
  },
)

export type LoginSubmission = {
  values: Record<string, FormRawValue>
  errors: {
    fields: Record<string, string[]>
    form: string[]
  }
}
