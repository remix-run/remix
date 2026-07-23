import type { ErrorAttributes, FormRawValue } from 'remix/data-schema/form'
import { clientEntry } from 'remix/ui'
import type { Handle } from 'remix/ui'
import button from 'remix/ui/button'
import checkbox from 'remix/ui/checkbox'
import { form as formValidation } from 'remix/ui/form'
import input from 'remix/ui/input'

import { RegistrationForm } from '../actions/registration/registration-form.ts'
import * as styles from '../actions/registration/styles.ts'
import { routes } from '../routes.ts'

export const RegistrationFields = clientEntry(
  import.meta.url,
  function RegistrationFields(handle: Handle<{ submission?: RegistrationSubmission }>) {
    return () => {
      let { submission } = handle.props

      return (
        <section aria-labelledby="registration-title" mix={styles.panel}>
          <div mix={styles.panelHeader}>
            <div>
              <p mix={styles.step}>Example form</p>
              <h2 id="registration-title" mix={styles.panelHeading}>
                Account details
              </h2>
            </div>
            <p mix={styles.requiredNote}>Required fields are marked in their labels.</p>
          </div>

          {submission?.errors.form.length ? (
            <div role="alert" mix={styles.formError}>
              {submission.errors.form.join(' ')}
            </div>
          ) : null}

          <form
            action={routes.registration.action.href()}
            method="post"
            mix={[formValidation(), styles.form]}
          >
            <div mix={styles.fieldGrid}>
              <div mix={styles.field}>
                <label {...RegistrationForm.getLabelAttrs('displayName')} mix={styles.label}>
                  {RegistrationForm.fields.displayName.label}
                  {RegistrationForm.fields.displayName.required ? (
                    <span mix={styles.required}>Required</span>
                  ) : (
                    <span mix={styles.optional}>Optional</span>
                  )}
                </label>
                <input
                  {...RegistrationForm.getInputAttrs('displayName', submission)}
                  autoComplete="name"
                  placeholder="Ada Lovelace"
                  mix={[input(), styles.control]}
                />
                <FieldErrors
                  attrs={RegistrationForm.getErrorAttrs('displayName')}
                  errors={RegistrationForm.getFieldErrors('displayName', submission)}
                />
              </div>

              <div mix={styles.field}>
                <label {...RegistrationForm.getLabelAttrs('email')} mix={styles.label}>
                  {RegistrationForm.fields.email.label}
                  {RegistrationForm.fields.email.required ? (
                    <span mix={styles.required}>Required</span>
                  ) : (
                    <span mix={styles.optional}>Optional</span>
                  )}
                </label>
                <input
                  {...RegistrationForm.getInputAttrs('email', submission)}
                  autoComplete="email"
                  placeholder="ada@example.com"
                  mix={[input(), styles.control]}
                />
                <FieldErrors
                  attrs={RegistrationForm.getErrorAttrs('email')}
                  errors={RegistrationForm.getFieldErrors('email', submission)}
                />
              </div>

              <div mix={styles.field}>
                <label {...RegistrationForm.getLabelAttrs('age')} mix={styles.label}>
                  {RegistrationForm.fields.age.label}
                  {RegistrationForm.fields.age.required ? (
                    <span mix={styles.required}>Required</span>
                  ) : (
                    <span mix={styles.optional}>Optional</span>
                  )}
                </label>
                <input
                  {...RegistrationForm.getInputAttrs('age', submission)}
                  inputMode="numeric"
                  placeholder="36"
                  mix={[input(), styles.control]}
                />
                <FieldErrors
                  attrs={RegistrationForm.getErrorAttrs('age')}
                  errors={RegistrationForm.getFieldErrors('age', submission)}
                />
              </div>

              <div mix={styles.field}>
                <label {...RegistrationForm.getLabelAttrs('website')} mix={styles.label}>
                  {RegistrationForm.fields.website.label}
                  {RegistrationForm.fields.website.required ? (
                    <span mix={styles.required}>Required</span>
                  ) : (
                    <span mix={styles.optional}>Optional</span>
                  )}
                </label>
                <input
                  {...RegistrationForm.getInputAttrs('website', submission)}
                  autoComplete="url"
                  placeholder="https://example.com"
                  mix={[input(), styles.control]}
                />
                <FieldErrors
                  attrs={RegistrationForm.getErrorAttrs('website')}
                  errors={RegistrationForm.getFieldErrors('website', submission)}
                />
              </div>
            </div>

            <div mix={styles.field}>
              <label {...RegistrationForm.getLabelAttrs('password')} mix={styles.label}>
                {RegistrationForm.fields.password.label}
                {RegistrationForm.fields.password.required ? (
                  <span mix={styles.required}>Required</span>
                ) : (
                  <span mix={styles.optional}>Optional</span>
                )}
              </label>
              <input
                {...RegistrationForm.getInputAttrs('password', submission)}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                mix={[input(), styles.control]}
              />
              <FieldErrors
                attrs={RegistrationForm.getErrorAttrs('password')}
                errors={RegistrationForm.getFieldErrors('password', submission)}
              />
            </div>

            <div mix={styles.checkboxField}>
              <input {...RegistrationForm.getInputAttrs('terms', submission)} mix={checkbox()} />
              <label {...RegistrationForm.getLabelAttrs('terms')} mix={styles.checkboxLabel}>
                {RegistrationForm.fields.terms.label}
                {RegistrationForm.fields.terms.required ? (
                  <span mix={styles.required}> Required</span>
                ) : null}
              </label>
              <FieldErrors
                attrs={RegistrationForm.getErrorAttrs('terms')}
                errors={RegistrationForm.getFieldErrors('terms', submission)}
              />
            </div>

            <button type="submit" mix={[button({ tone: 'primary' }), styles.submitButton]}>
              Validate account
            </button>
          </form>
        </section>
      )
    }
  },
)

export type RegistrationSubmission = {
  values: Record<string, FormRawValue>
  errors: {
    fields: Record<string, string[]>
    form: string[]
  }
}

interface FieldErrorsProps {
  attrs: ErrorAttributes
  errors: ReadonlyArray<string>
}

function FieldErrors(handle: Handle<FieldErrorsProps>) {
  return () => {
    let { attrs, errors } = handle.props

    return errors.length > 0 ? (
      <p {...attrs} role="alert" mix={styles.fieldError}>
        {errors.join(' ')}
      </p>
    ) : null
  }
}
