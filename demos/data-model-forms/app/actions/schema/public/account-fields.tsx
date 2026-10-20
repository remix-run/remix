import type { FormSubmission } from '@remix-run/ui/form'
import { clientEntry, on } from 'remix/component'
import type { Handle } from 'remix/component'
import { createFormMixins } from '@remix-run/ui/form'

import { AccountForm } from './account-form.ts'
import * as styles from '../../../ui/public/styles.ts'
import { routes } from '../../../routes.ts'

export const AccountFields = clientEntry(
  import.meta.url,
  function AccountFields(handle: Handle<{ submission?: FormSubmission }>) {
    let { form, field, label, error, fields } = createFormMixins(AccountForm, {
      getSubmission: () => handle.props.submission,
      onChange: () => handle.update(),
    })
    let hydrated = false
    handle.queueTask(() => {
      hydrated = true
      handle.update()
    })

    return () => (
      <section aria-labelledby="account-title" mix={styles.panel}>
        <div mix={styles.panelHeader}>
          <div>
            <p mix={styles.step}>createForm + createFormMixins</p>
            <h2 id="account-title" mix={styles.panelHeading}>
              Account details
            </h2>
          </div>
          <p mix={styles.requiredNote}>Required fields are marked in their labels.</p>
        </div>
        <form action={routes.schema.action.href()} method="post" mix={[form(), styles.form]}>
          {handle.props.submission?.errors.form.length ? (
            <p role="alert" mix={styles.formError}>
              {handle.props.submission.errors.form.join(' ')}
            </p>
          ) : null}
          <div mix={styles.fieldGrid}>
            <div mix={styles.field}>
              <label mix={[label('displayName'), styles.label]}>
                {AccountForm.fields.displayName.label}
                {AccountForm.fields.displayName.required ? (
                  <span mix={styles.required}>Required</span>
                ) : null}
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
                {AccountForm.fields.email.label}
                {AccountForm.fields.email.required ? (
                  <span mix={styles.required}>Required</span>
                ) : null}
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
                {AccountForm.fields.age.label}
                <span mix={styles.optional}>
                  {AccountForm.fields.age.required ? 'Required' : 'Optional'}
                </span>
              </label>
              <input inputMode="numeric" placeholder="36" mix={[field('age'), styles.control]} />
              <p role="alert" mix={[error('age'), styles.fieldError]}>
                {fields.age.errors.join(' ')}
              </p>
            </div>
            <div mix={styles.field}>
              <label mix={[label('website'), styles.label]}>
                {AccountForm.fields.website.label}
                <span mix={styles.optional}>
                  {AccountForm.fields.website.required ? 'Required' : 'Optional'}
                </span>
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
    )
  },
)
