import type { FormRawValue } from 'remix/data-schema/form'
import { clientEntry, css } from 'remix/component'
import type { Handle } from 'remix/component'
import { createInputMixin, form as formValidation } from '@remix-run/ui/form'

import { LoginForm } from '../../auth/login/login-form.ts'

const loginInput = createInputMixin(LoginForm)

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
            <div class="alert alert-error" role="alert" mix={css({ marginBottom: '1.5rem' })}>
              {submission.errors.form.join(' ')}
            </div>
          ) : null}

          <form method="POST" action={formAction} mix={formValidation()}>
            <div class="form-group">
              <label {...LoginForm.getLabelAttrs('email')}>{LoginForm.fields.email.label}</label>
              <input autoComplete="email" mix={loginInput('email', submission)} />
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
              <input autoComplete="current-password" mix={loginInput('password', submission)} />
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
