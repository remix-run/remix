import * as form from '@remix-run/ui/form'
import type { FieldBinding } from '@remix-run/ui/form'
import type { FormSubmission } from 'remix/data-schema/form'
import { clientEntry } from 'remix/component'
import type { Handle } from 'remix/component'
import { AccountForm } from './fields.ts'
import * as styles from '../../../ui/public/styles.ts'
import { routes } from '../../../routes.ts'

function AccountField(
  handle: Handle<{
    field: FieldBinding<'text'>
    label: string
    type?: 'text' | 'email'
    autoComplete: string
  }>,
) {
  return () => {
    let { field, label, type, autoComplete } = handle.props
    return (
      <div mix={styles.field}>
        <label mix={[form.label(field), styles.label]}>
          {label}
          <span mix={styles.required}>Required</span>
        </label>
        <input
          {...(type === 'email' ? { type: 'email' as const } : { type: 'text' as const })}
          autoComplete={autoComplete}
          mix={[form.control(field), styles.control]}
        />
        <p role="alert" mix={[form.error(field), styles.fieldError]}>
          {field.errors.join(' ')}
        </p>
        <small>Field state: touched {String(field.touched)}</small>
      </div>
    )
  }
}

export const AccountFields = clientEntry(
  import.meta.url,
  function AccountFields(handle: Handle<{ submission?: FormSubmission }>) {
    return () => (
      <form.Context id={handle.id} schema={AccountForm} submission={handle.props.submission}>
        {({ fields, errors }) => (
          <section aria-labelledby="account-title" mix={styles.panel}>
            <h2 id="account-title" mix={styles.panelHeading}>
              Account details
            </h2>
            <p>Field components receive live bindings through props.</p>
            <form
              action={routes.fields.action.href()}
              method="post"
              mix={[form.root(), styles.form]}
            >
              {errors.form.length > 0 && (
                <p role="alert" mix={styles.formError}>
                  {errors.form.join(' ')}
                </p>
              )}
              <AccountField field={fields.displayName} label="Display name" autoComplete="name" />
              <AccountField
                field={fields.email}
                label="Email address"
                type="email"
                autoComplete="email"
              />
              <button type="submit" mix={styles.submitButton}>
                Save account
              </button>
            </form>
          </section>
        )}
      </form.Context>
    )
  },
)
