import type { FormRawValue } from '@remix-run/ui/form'
import { clientEntry, css } from 'remix/component'
import type { Handle } from 'remix/component'
import { createFormMixins } from '@remix-run/ui/form'

import { LoginForm } from '../../auth/login/login-form.ts'

export const LoginFields = clientEntry(
  import.meta.url,
  function LoginFields(handle: Handle<{ formAction: string; submission?: LoginSubmission }>) {
    let { form, field, label, error, fields } = createFormMixins(LoginForm, {
      getSubmission: () => handle.props.submission,
      onChange: () => handle.update(),
    })

    return () => {
      let { formAction, submission } = handle.props

      return (
        <>
          {submission?.errors.form.length ? (
            <div class="alert alert-error" role="alert" mix={css({ marginBottom: '1.5rem' })}>
              {submission.errors.form.join(' ')}
            </div>
          ) : null}

          <form method="POST" action={formAction} mix={form()}>
            <div class="form-group">
              <label mix={label('email')}>{LoginForm.fields.email.label}</label>
              <input autoComplete="email" mix={field('email')} />
              {fields.email.errors.length > 0 ? (
                <p mix={error('email')} role="alert">
                  {fields.email.errors.join(' ')}
                </p>
              ) : null}
            </div>

            <div class="form-group">
              <label mix={label('password')}>{LoginForm.fields.password.label}</label>
              <input autoComplete="current-password" mix={field('password')} />
              {fields.password.errors.length > 0 ? (
                <p mix={error('password')} role="alert">
                  {fields.password.errors.join(' ')}
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
