import type { FormSubmission } from '@remix-run/ui/form'
import { clientEntry, on } from 'remix/component'
import type { Handle } from 'remix/component'
import { createFieldMixins } from '@remix-run/ui/form'

import { DisplayName, Email } from './fields.ts'
import * as styles from '../../../ui/public/styles.ts'
import { routes } from '../../../routes.ts'

export const AccountFields = clientEntry(
  import.meta.url,
  function AccountFields(handle: Handle<{ submission?: FormSubmission }>) {
    let displayName = createFieldMixins(DisplayName, {
      name: 'displayName',
      getSubmission: () => handle.props.submission,
      onChange: () => handle.update(),
    })
    let email = createFieldMixins(Email, {
      name: 'email',
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
            <p mix={styles.step}>createField + createFieldMixins</p>
            <h2 id="account-title" mix={styles.panelHeading}>
              Account details
            </h2>
          </div>
          <p mix={styles.requiredNote}>Two independent bindings in one native form.</p>
        </div>
        <form action={routes.fields.action.href()} method="post" mix={styles.form}>
          {handle.props.submission?.errors.form.length ? (
            <p role="alert" mix={styles.formError}>
              {handle.props.submission.errors.form.join(' ')}
            </p>
          ) : null}
          <div mix={styles.field}>
            <label mix={[displayName.label(), styles.label]}>
              {DisplayName.label}
              {DisplayName.required ? <span mix={styles.required}>Required</span> : null}
            </label>
            <input
              autoComplete="name"
              placeholder="Ada Lovelace"
              mix={[displayName.field(), styles.control]}
            />
            <p role="alert" mix={[displayName.error(), styles.fieldError]}>
              {displayName.errors.join(' ')}
            </p>
            {hydrated ? <small>Field state: touched {String(displayName.touched)}</small> : null}
          </div>
          <div mix={styles.field}>
            <label mix={[email.label(), styles.label]}>
              {Email.label}
              {Email.required ? <span mix={styles.required}>Required</span> : null}
            </label>
            <input
              autoComplete="email"
              placeholder="ada@example.com"
              mix={[email.field(), styles.control]}
            />
            <p role="alert" mix={[email.error(), styles.fieldError]}>
              {email.errors.join(' ')}
            </p>
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
