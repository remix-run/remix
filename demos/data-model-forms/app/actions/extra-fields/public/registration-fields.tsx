import type { FormSubmission } from '@remix-run/ui/form'
import { clientEntry, on } from 'remix/component'
import type { Handle } from 'remix/component'
import { createFormMixins } from '@remix-run/ui/form'

import { RegistrationForm } from './registration-form.ts'
import * as styles from '../../../ui/public/styles.ts'
import { routes } from '../../../routes.ts'

export const RegistrationFields = clientEntry(
  import.meta.url,
  function RegistrationFields(handle: Handle<{ submission?: FormSubmission }>) {
    let { form, field, label, error, fields } = createFormMixins(RegistrationForm, {
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
            action={routes['extra-fields'].action.href()}
            method="post"
            mix={[form(), styles.form]}
          >
            <div mix={styles.fieldGrid}>
              <div mix={styles.field}>
                <label mix={[label('displayName'), styles.label]}>
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
                  mix={[field('displayName'), styles.control]}
                />
                <p role="alert" mix={[error('displayName'), styles.fieldError]}>
                  {fields.displayName.errors.join(' ')}
                </p>
                {hydrated ? (
                  <small>Field state: touched {String(fields.displayName.touched)}</small>
                ) : null}
              </div>

              <div mix={styles.field}>
                <label mix={[label('email'), styles.label]}>
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
                  mix={[field('email'), styles.control]}
                />
                <p role="alert" mix={[error('email'), styles.fieldError]}>
                  {fields.email.errors.join(' ')}
                </p>
              </div>

              <div mix={styles.field}>
                <label mix={[label('age'), styles.label]}>
                  {RegistrationForm.fields.age.label}
                  {RegistrationForm.fields.age.required ? (
                    <span mix={styles.required}>Required</span>
                  ) : (
                    <span mix={styles.optional}>Optional</span>
                  )}
                </label>
                <input inputMode="numeric" placeholder="36" mix={[field('age'), styles.control]} />
                <p role="alert" mix={[error('age'), styles.fieldError]}>
                  {fields.age.errors.join(' ')}
                </p>
              </div>

              <div mix={styles.field}>
                <label mix={[label('website'), styles.label]}>
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
                  mix={[field('website'), styles.control]}
                />
                <p role="alert" mix={[error('website'), styles.fieldError]}>
                  {fields.website.errors.join(' ')}
                </p>
              </div>
            </div>

            <div mix={styles.field}>
              <label mix={[label('password'), styles.label]}>
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
                mix={[field('password'), styles.control]}
              />
              <p role="alert" mix={[error('password'), styles.fieldError]}>
                {fields.password.errors.join(' ')}
              </p>
            </div>

            <div mix={styles.checkboxField}>
              <input mix={[field('terms'), styles.checkbox]} />
              <label mix={[label('terms'), styles.checkboxLabel]}>
                {RegistrationForm.fields.terms.label}
                {RegistrationForm.fields.terms.required ? (
                  <span mix={styles.required}> Required</span>
                ) : null}
              </label>
              <p role="alert" mix={[error('terms'), styles.fieldError]}>
                {fields.terms.errors.join(' ')}
              </p>
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
