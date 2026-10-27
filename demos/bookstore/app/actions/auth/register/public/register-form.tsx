import * as form from '@remix-run/ui/form'
import type { FormSubmission } from 'remix/data-schema/form'
import { clientEntry } from 'remix/component'
import type { Handle } from 'remix/component'

import { routes } from '../../../../routes.ts'
import { Field } from '../../../../ui/public/field.tsx'
import { RegistrationForm } from '../../schemas.ts'

export const RegisterFields = clientEntry(
  import.meta.url,
  function RegisterFields(handle: Handle<{ submission?: FormSubmission }>) {
    return () => (
      <form.Context id={handle.id} schema={RegistrationForm} submission={handle.props.submission}>
        {({ fields, errors }) => (
          <form method="POST" action={routes.auth.register.action.href()} mix={form.root()}>
            {errors.form && <p role="alert">{errors.form.join(' ')}</p>}
            <Field field={fields.name} label="Name" input={{ autoComplete: 'name' }} />
            <Field
              field={fields.email}
              label="Email"
              type="email"
              input={{ autoComplete: 'email' }}
            />
            <Field
              field={fields.password}
              label="Password"
              input={{ autoComplete: 'new-password' }}
            />
            <button type="submit" class="btn">
              Register
            </button>
          </form>
        )}
      </form.Context>
    )
  },
)
