import * as s from 'remix/data-schema'
import * as fd from 'remix/data-schema/form'
import { email, minLength } from 'remix/data-schema/checks'
import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'
import * as form from '@remix-run/ui/form'

const Contact = fd.object({
  name: fd.text(s.string().pipe(minLength(2))),
  email: fd.text(s.string().pipe(email())),
})

export default function ExampleForm(handle: Handle) {
  let checked = false

  return () => (
    <form.Context id={handle.id} schema={Contact}>
      {({ fields }) => (
        <form
          autocomplete="off"
          mix={[
            form.root(),
            on('input', () => {
              if (checked) {
                checked = false
                handle.update()
              }
            }),
            on('submit', (event) => {
              event.preventDefault()
              let result = Contact.parseSafe(new FormData(event.currentTarget))
              checked = result.success
              handle.update()
            }),
            styles.root,
          ]}
        >
          <h3 mix={styles.heading}>Contact details</h3>
          <p mix={styles.intro}>Check that your name and email address are ready to submit.</p>
          <div mix={styles.field}>
            <label mix={[form.label(fields.name), styles.label]}>Name</label>
            <input autocomplete="off" mix={[form.control(fields.name), styles.input]} />
            <p role="alert" mix={[form.error(fields.name), styles.error]}>
              {fields.name.errors.join(' ')}
            </p>
          </div>
          <div mix={styles.field}>
            <label mix={[form.label(fields.email), styles.label]}>Email address</label>
            <input
              type="email"
              autocomplete="off"
              mix={[form.control(fields.email), styles.input]}
            />
            <p role="alert" mix={[form.error(fields.email), styles.error]}>
              {fields.email.errors.join(' ')}
            </p>
          </div>
          <button type="submit" mix={styles.button}>
            Check details
          </button>
          {checked ? (
            <p role="status" mix={styles.success}>
              Details are valid
            </p>
          ) : null}
        </form>
      )}
    </form.Context>
  )
}

const styles = {
  root: css({
    '--focus-ring': 'light-dark(#70707c, #a0a0ac)',
    colorScheme: 'light dark',
    width: '340px',
    maxWidth: '100%',
    display: 'grid',
    gap: '12px',
    padding: '20px',
    border: '1px solid light-dark(#e0e0e6, #393940)',
    borderRadius: '12px',
    background: 'light-dark(#fff, #1b1b20)',
    color: 'light-dark(#202027, #eeeef2)',
    font: '14px/1.5 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
    '&, & *': {
      boxSizing: 'border-box',
    },
  }),
  heading: css({
    margin: 0,
    fontSize: '16px',
    fontWeight: 650,
  }),
  intro: css({
    margin: '-8px 0 2px',
    color: 'light-dark(#62626c, #b0b0bb)',
  }),
  field: css({
    display: 'grid',
    gap: '5px',
  }),
  label: css({
    fontWeight: 600,
  }),
  input: css({
    width: '100%',
    minHeight: '40px',
    padding: '8px 10px',
    border: '1px solid light-dark(#c9c9d2, #494951)',
    borderRadius: '7px',
    background: 'light-dark(#fff, #25252b)',
    color: 'inherit',
    font: 'inherit',
    '&:focus-visible': {
      outline: '2px solid var(--focus-ring)',
      outlineOffset: '2px',
    },
    '&[aria-invalid="true"]': {
      borderColor: 'light-dark(#9f4a4a, #dc8c8c)',
    },
  }),
  error: css({
    minHeight: '18px',
    margin: 0,
    color: 'light-dark(#993f3f, #ec9e9e)',
    fontSize: '12px',
  }),
  button: css({
    minHeight: '40px',
    padding: '8px 14px',
    border: '1px solid light-dark(#292930, #d1d1d8)',
    borderRadius: '7px',
    background: 'light-dark(#292930, #d1d1d8)',
    color: 'light-dark(#fff, #202027)',
    font: 'inherit',
    fontWeight: 600,
    cursor: 'pointer',
    '&:focus-visible': {
      outline: '2px solid var(--focus-ring)',
      outlineOffset: '2px',
    },
  }),
  success: css({
    margin: 0,
    color: 'light-dark(#2c603e, #9bcfac)',
    fontSize: '12px',
  }),
}
