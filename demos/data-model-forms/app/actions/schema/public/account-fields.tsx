import type { FormSubmission } from 'remix/data-schema/form'
import { clientEntry, on } from 'remix/component'
import type { Handle } from 'remix/component'
import * as form from '@remix-run/ui/form'

import { AccountForm } from './account-form.ts'
import * as styles from '../../../ui/public/styles.ts'
import { routes } from '../../../routes.ts'

export const AccountFields = clientEntry(
  import.meta.url,
  function AccountFields(handle: Handle<{ submission?: FormSubmission }>) {
    let hydrated = false
    handle.queueTask(() => {
      hydrated = true
      handle.update()
    })

    return () => (
      <form.Context id={handle.id} schema={AccountForm} submission={handle.props.submission}>
        {({ fields, errors }) => (
          <section aria-labelledby="account-title" mix={styles.panel}>
            <div mix={styles.panelHeader}>
              <div>
                <p mix={styles.step}>Form schema + Context</p>
                <h2 id="account-title" mix={styles.panelHeading}>
                  Account details
                </h2>
              </div>
              <p mix={styles.requiredNote}>Required fields are marked in their labels.</p>
            </div>
            <form
              action={routes.schema.action.href()}
              method="post"
              mix={[form.root(), styles.form]}
            >
              {errors.form ? (
                <p role="alert" mix={styles.formError}>
                  {errors.form.join(' ')}
                </p>
              ) : null}
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
              <div mix={styles.formActions}>
                <button type="submit" mix={styles.submitButton}>
                  Save account
                </button>
                <button
                  type="button"
                  disabled={!hydrated}
                  mix={[
                    styles.fillButton,
                    on('click', (event) => {
                      let form = event.currentTarget.form
                      if (!form) return
                      for (let [name, value] of Object.entries({
                        displayName: 'Ada Lovelace',
                        email: 'ada@example.com',
                        age: '36',
                        website: 'https://example.com',
                      })) {
                        let input = form.elements.namedItem(name)
                        if (!(input instanceof HTMLInputElement)) continue
                        input.value = value
                        input.dispatchEvent(new Event('input', { bubbles: true }))
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
  },
)
