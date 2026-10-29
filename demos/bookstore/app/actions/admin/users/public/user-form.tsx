import * as form from '@remix-run/ui/form'
import type { FormSubmission } from 'remix/data-schema/form'
import { clientEntry, css } from 'remix/component'
import type { Handle } from 'remix/component'

import { Field } from '../../../../ui/public/field.tsx'
import { RestfulForm } from '../../../../ui/restful-form.tsx'
import { AdminUserForm } from './schema.ts'

interface AdminUserFieldsProps {
  action: string
  cancelHref: string
  submitLabel: string
  name: string
  email: string
  role: string
  submission?: FormSubmission
}

export const AdminUserFields = clientEntry(
  import.meta.url,
  function AdminUserFields(handle: Handle<AdminUserFieldsProps>) {
    return () => {
      let { action, cancelHref, submitLabel, name, email, role, submission } = handle.props
      let submittedName = submission?.values.name
      let submittedEmail = submission?.values.email
      let submittedRole = submission?.values.role
      let selectedRole = typeof submittedRole === 'string' ? submittedRole : role
      return (
        <form.Context id={handle.id} schema={AdminUserForm} submission={submission}>
          {({ fields, errors }) => (
            <RestfulForm method="PUT" action={action} mix={form.root()}>
              {errors.form && <p role="alert">{errors.form.join(' ')}</p>}
              <Field
                field={fields.name}
                label="Name"
                defaultValue={typeof submittedName === 'string' ? submittedName : name}
              />
              <Field
                field={fields.email}
                label="Email"
                type="email"
                defaultValue={typeof submittedEmail === 'string' ? submittedEmail : email}
              />
              <Field field={fields.role} label="Role">
                <select mix={form.control(fields.role)}>
                  <option value="customer" selected={selectedRole === 'customer'}>
                    Customer
                  </option>
                  <option value="admin" selected={selectedRole === 'admin'}>
                    Admin
                  </option>
                </select>
              </Field>
              <button type="submit" class="btn">
                {submitLabel}
              </button>
              <a
                data-rmx-prefetch="intent"
                href={cancelHref}
                class="btn btn-secondary"
                mix={css({ marginLeft: '0.5rem' })}
              >
                Cancel
              </a>
            </RestfulForm>
          )}
        </form.Context>
      )
    }
  },
)
