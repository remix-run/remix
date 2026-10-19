import type { FormRawValue } from 'remix/data-schema/form'
import { clientEntry, on } from 'remix/component'
import type { Handle } from 'remix/component'
import { createFormMixins } from '@remix-run/ui/form'

import { RegistrationForm } from './registration-form.ts'
import * as styles from './styles.ts'
import { routes } from '../../../routes.ts'

export const RegistrationFields = clientEntry(
  import.meta.url,
  function RegistrationFields(handle: Handle<{ submission?: RegistrationSubmission }>) {
    let { form, input, error, errors } = createFormMixins(RegistrationForm, {
      getSubmission: () => handle.props.submission,
      onChange: () => handle.update(),
    })
    let hydrated = false

    handle.queueTask(() => {
      hydrated = true
      handle.update()
    })

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
            mix={[form(), styles.form]}
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
                  autoComplete="name"
                  placeholder="Ada Lovelace"
                  mix={[input('displayName'), styles.control]}
                />
                {errors.displayName.length > 0 ? (
                  <p role="alert" mix={[error('displayName'), styles.fieldError]}>
                    {errors.displayName.join(' ')}
                  </p>
                ) : null}
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
                  autoComplete="email"
                  placeholder="ada@example.com"
                  mix={[input('email'), styles.control]}
                />
                {errors.email.length > 0 ? (
                  <p role="alert" mix={[error('email'), styles.fieldError]}>
                    {errors.email.join(' ')}
                  </p>
                ) : null}
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
                <input inputMode="numeric" placeholder="36" mix={[input('age'), styles.control]} />
                {errors.age.length > 0 ? (
                  <p role="alert" mix={[error('age'), styles.fieldError]}>
                    {errors.age.join(' ')}
                  </p>
                ) : null}
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
                  autoComplete="url"
                  placeholder="https://example.com"
                  mix={[input('website'), styles.control]}
                />
                {errors.website.length > 0 ? (
                  <p role="alert" mix={[error('website'), styles.fieldError]}>
                    {errors.website.join(' ')}
                  </p>
                ) : null}
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
                autoComplete="new-password"
                placeholder="At least 8 characters"
                mix={[input('password'), styles.control]}
              />
              {errors.password.length > 0 ? (
                <p role="alert" mix={[error('password'), styles.fieldError]}>
                  {errors.password.join(' ')}
                </p>
              ) : null}
            </div>

            <div mix={styles.checkboxField}>
              <input mix={[input('terms'), styles.checkbox]} />
              <label {...RegistrationForm.getLabelAttrs('terms')} mix={styles.checkboxLabel}>
                {RegistrationForm.fields.terms.label}
                {RegistrationForm.fields.terms.required ? (
                  <span mix={styles.required}> Required</span>
                ) : null}
              </label>
              {errors.terms.length > 0 ? (
                <p role="alert" mix={[error('terms'), styles.fieldError]}>
                  {errors.terms.join(' ')}
                </p>
              ) : null}
            </div>

            <div mix={styles.formActions}>
              <button type="submit" mix={styles.submitButton}>
                Validate account
              </button>
              <button
                type="button"
                disabled={!hydrated}
                mix={[
                  styles.fillButton,
                  on('click', (event) => {
                    let form = event.currentTarget.form
                    if (!form) return

                    let values = {
                      displayName: 'Ada Lovelace',
                      email: 'ada@example.com',
                      age: '36',
                      website: 'https://example.com',
                      password: 'demo-password-123',
                      terms: true,
                    }

                    for (let [name, value] of Object.entries(values)) {
                      let input = form.elements.namedItem(name)
                      if (!(input instanceof HTMLInputElement)) continue

                      if (typeof value === 'boolean') {
                        input.checked = value
                      } else {
                        input.value = value
                      }

                      input.dispatchEvent(new Event('input', { bubbles: true }))
                      input.dispatchEvent(new Event('change', { bubbles: true }))
                    }
                  }),
                ]}
              >
                Fill demo values
              </button>
            </div>
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
