import { useState } from 'preact/hooks'

import {
  hasErrors,
  MAX_MESSAGE_LENGTH,
  validateEntry,
  type EntryErrors,
  type EntryValues,
} from '../../../utils/public/validate-entry.ts'

export interface EntryFormProps {
  action: string
  values: EntryValues
  errors: EntryErrors
}

/**
 * A plain HTML form that posts to the server. Once hydrated, Preact adds a live character
 * count and re-validates on input using the same rules the server applies.
 */
export function EntryForm(props: EntryFormProps) {
  let [values, setValues] = useState(props.values)
  let [touched, setTouched] = useState(false)

  // Show the server's errors until the user edits, then validate live with the shared rules.
  let errors = touched ? validateEntry(values) : props.errors

  function update(field: keyof EntryValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setTouched(true)
  }

  let remaining = MAX_MESSAGE_LENGTH - values.message.length

  return (
    <form method="post" action={props.action} noValidate>
      <div class="field">
        <label for="entry-name">Name</label>
        <input
          id="entry-name"
          name="name"
          type="text"
          autocomplete="name"
          value={values.name}
          aria-invalid={errors.name !== undefined}
          aria-describedby={errors.name ? 'entry-name-error' : undefined}
          onInput={(event) => update('name', event.currentTarget.value)}
        />
        {errors.name && (
          <p id="entry-name-error" class="error">
            {errors.name}
          </p>
        )}
      </div>

      <div class="field">
        <label for="entry-message">Message</label>
        <textarea
          id="entry-message"
          name="message"
          rows={3}
          value={values.message}
          aria-invalid={errors.message !== undefined}
          aria-describedby="entry-message-hint"
          onInput={(event) => update('message', event.currentTarget.value)}
        />
        <p id="entry-message-hint" class={remaining < 0 ? 'hint error' : 'hint'}>
          {errors.message ?? `${remaining} characters left`}
        </p>
      </div>

      <button type="submit" disabled={touched && hasErrors(errors)}>
        Sign the guestbook
      </button>
    </form>
  )
}
