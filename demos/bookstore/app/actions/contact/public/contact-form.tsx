import * as form from '@remix-run/ui/form'
import type { FormSubmission } from 'remix/data-schema/form'
import { clientEntry } from 'remix/component'
import type { Handle } from 'remix/component'

import { routes } from '../../../routes.ts'
import { Field } from '../../../ui/public/field.tsx'
import { ContactForm } from './schema.ts'

export const ContactFields = clientEntry(
  import.meta.url,
  function ContactFields(handle: Handle<{ submission?: FormSubmission }>) {
    return () => (
      <form.Context id={handle.id} schema={ContactForm} submission={handle.props.submission}>
        {({ fields, errors }) => (
          <form method="POST" action={routes.contact.action.href()} mix={form.root()}>
            {errors.form && <p role="alert">{errors.form.join(' ')}</p>}
            <Field field={fields.name} label="Name" />
            <Field field={fields.email} label="Email" type="email" />
            <Field field={fields.message} label="Message">
              <textarea mix={form.control(fields.message)} />
            </Field>
            <button type="submit" class="btn">
              Send Message
            </button>
          </form>
        )}
      </form.Context>
    )
  },
)
