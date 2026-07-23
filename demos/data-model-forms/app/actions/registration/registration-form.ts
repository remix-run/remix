import * as s from 'remix/data-schema'
import { maxLength, minLength } from 'remix/data-schema/checks'
import { createForm } from 'remix/data-schema/form'

import { Account } from '../../data/account-schema.ts'

export const RegistrationForm = createForm(Account, {
  fields: {
    displayName: { label: 'Display name', type: 'text' },
    email: { label: 'Email address', type: 'email' },
    age: { label: 'Age', type: 'number' },
    website: { label: 'Website', type: 'url' },
    password: {
      label: 'Password',
      type: 'password',
      schema: s.string().pipe(minLength(8), maxLength(72)),
    },
    terms: {
      label: 'I agree to the terms of service',
      type: 'checkbox',
      schema: s.literal(true),
    },
  },
})
