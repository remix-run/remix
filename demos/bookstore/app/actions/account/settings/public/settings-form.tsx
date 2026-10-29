import * as form from '@remix-run/ui/form'
import type { FormSubmission } from 'remix/data-schema/form'
import { clientEntry, css } from 'remix/component'
import type { Handle } from 'remix/component'

import { routes } from '../../../../routes.ts'
import { Field } from '../../../../ui/public/field.tsx'
import { RestfulForm } from '../../../../ui/restful-form.tsx'
import { AccountSettingsForm } from './schema.ts'

export const AccountSettingsFields = clientEntry(
  import.meta.url,
  function AccountSettingsFields(
    handle: Handle<{ name: string; email: string; submission?: FormSubmission }>,
  ) {
    return () => {
      let { name, email, submission } = handle.props
      let submittedName = submission?.values.name
      let submittedEmail = submission?.values.email
      return (
        <form.Context id={handle.id} schema={AccountSettingsForm} submission={submission}>
          {({ fields, errors }) => (
            <RestfulForm
              method="PUT"
              action={routes.account.settings.update.href()}
              mix={form.root()}
            >
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
              <Field
                field={fields.password}
                label="New Password (leave blank to keep current)"
                autoComplete="new-password"
              />
              <button type="submit" class="btn">
                Update Settings
              </button>
              <a
                data-rmx-prefetch="intent"
                href={routes.account.index.href()}
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
