import * as s from 'remix/data-schema'
import { maxLength, minLength } from 'remix/data-schema/checks'
import { createField, createForm } from 'remix/data-schema/form'

import { Account } from '../../../data/public/account-schema.ts'

export const Password = createField({
  label: 'Password',
  type: 'password',
  schema: s.string().pipe(minLength(8), maxLength(72)),
})

export const RegistrationForm = createForm({
  schema: Account,
  fields: {
    displayName: { label: 'Display name', type: 'text' },
    email: { label: 'Email address', type: 'email' },
    age: { label: 'Age', type: 'number' },
    website: { label: 'Website', type: 'url' },
    password: Password,
    terms: {
      label: 'I agree to the terms of service',
      type: 'checkbox',
      schema: s.literal(true),
    },
  },
})
