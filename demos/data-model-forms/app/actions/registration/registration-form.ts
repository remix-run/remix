import * as s from 'remix/data-schema'
import { email, max, maxLength, min, minLength, url } from 'remix/data-schema/checks'
import { createForm } from 'remix/data-schema/form'

const Account = s.object({
  id: s.string(),
  displayName: s.string().pipe(minLength(2), maxLength(50)),
  email: s.string().pipe(email()),
  age: s.optional(s.number().pipe(min(18), max(120))),
  website: s.optional(s.string().pipe(url())),
  password: s.string().pipe(minLength(8), maxLength(72)),
})

export const RegistrationForm = createForm(Account, {
  fields: {
    displayName: { label: 'Display name', type: 'text' },
    email: { label: 'Email address', type: 'email' },
    age: { label: 'Age', type: 'number' },
    website: { label: 'Website', type: 'url' },
    password: { label: 'Password', type: 'password' },
    terms: {
      label: 'I agree to the terms of service',
      type: 'checkbox',
      schema: s.literal(true),
    },
  },
})
