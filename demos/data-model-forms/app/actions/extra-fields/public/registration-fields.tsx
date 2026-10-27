import type { FormSubmission } from 'remix/data-schema/form'
import { clientEntry, on } from 'remix/component'
import type { Handle } from 'remix/component'
import * as form from '@remix-run/ui/form'

import { RegistrationForm } from './registration-form.ts'
import * as styles from '../../../ui/public/styles.ts'
import { routes } from '../../../routes.ts'

export const RegistrationFields = clientEntry(
  import.meta.url,
  function RegistrationFields(handle: Handle<{ submission?: FormSubmission }>) {
    let hydrated = false

    handle.queueTask(() => {
      hydrated = true
      handle.update()
    })

    return () => {
      let { submission } = handle.props

      return (
        <form.Context id={handle.id} schema={RegistrationForm} submission={submission}>
          {({ fields }) => (
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
                mix={[form.root(), styles.form]}
              >
                <div mix={styles.fieldGrid}>
                  <div mix={styles.field}>
                    <label mix={[form.label(fields.displayName), styles.label]}>
                      Display name
                      <span mix={styles.required}>Required</span>
                    </label>
                    <input
                      autoComplete="name"
                      placeholder="Ada Lovelace"
                      mix={[form.control(fields.displayName), styles.control]}
                    />
                    <p role="alert" mix={[form.error(fields.displayName), styles.fieldError]}>
                      {fields.displayName.errors.join(' ')}
                    </p>
                    {hydrated ? (
                      <small>Field state: touched {String(fields.displayName.touched)}</small>
                    ) : null}
                  </div>

                  <div mix={styles.field}>
                    <label mix={[form.label(fields.email), styles.label]}>
                      Email address
                      <span mix={styles.required}>Required</span>
                    </label>
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="ada@example.com"
                      mix={[form.control(fields.email), styles.control]}
                    />
                    <p role="alert" mix={[form.error(fields.email), styles.fieldError]}>
                      {fields.email.errors.join(' ')}
                    </p>
                  </div>

                  <div mix={styles.field}>
                    <label mix={[form.label(fields.age), styles.label]}>
                      Age
                      <span mix={styles.optional}>Optional</span>
                    </label>
                    <input
                      inputMode="numeric"
                      placeholder="36"
                      mix={[form.control(fields.age), styles.control]}
                    />
                    <p role="alert" mix={[form.error(fields.age), styles.fieldError]}>
                      {fields.age.errors.join(' ')}
                    </p>
                  </div>

                  <div mix={styles.field}>
                    <label mix={[form.label(fields.website), styles.label]}>
                      Website
                      <span mix={styles.optional}>Optional</span>
                    </label>
                    <input
                      type="url"
                      autoComplete="url"
                      placeholder="https://example.com"
                      mix={[form.control(fields.website), styles.control]}
                    />
                    <p role="alert" mix={[form.error(fields.website), styles.fieldError]}>
                      {fields.website.errors.join(' ')}
                    </p>
                  </div>
                </div>

                <div mix={styles.field}>
                  <label mix={[form.label(fields.password), styles.label]}>
                    Password
                    <span mix={styles.required}>Required</span>
                  </label>
                  <input
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    mix={[form.control(fields.password), styles.control]}
                  />
                  <p role="alert" mix={[form.error(fields.password), styles.fieldError]}>
                    {fields.password.errors.join(' ')}
                  </p>
                </div>

                <div mix={styles.checkboxField}>
                  <input mix={[form.control(fields.terms), styles.checkbox]} />
                  <label mix={[form.label(fields.terms), styles.checkboxLabel]}>
                    I agree to the terms of service
                    <span mix={styles.required}>Required</span>
                  </label>
                  <p role="alert" mix={[form.error(fields.terms), styles.fieldError]}>
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
          )}
        </form.Context>
      )
    }
  },
)
