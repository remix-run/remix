import * as s from 'remix/data-schema'
import { maxLength, minLength } from 'remix/data-schema/checks'
import { createField, createForm } from '@remix-run/ui/form'

import { Account } from '../../../data/public/account-schema.ts'

export const Password = createField({
  label: 'Password',
  type: 'password',
  schema: s.string().pipe(minLength(8), maxLength(72)),
  errorMap({ code }) {
    if (code === 'value.required') return 'Enter your password'
    if (code === 'string.min_length') return 'password must be 8+ characters'
  },
})

export const RegistrationForm = createForm({
  schema: Account,
  fields: {
    displayName: {
      label: 'Display name',
      type: 'text',
      errorMap({ code }) {
        if (code === 'value.required') return 'Enter your display name'
        if (code === 'string.min_length') return 'Use at least 2 characters for your display name'
      },
    },
    email: { label: 'Email address', type: 'email' },
    age: { label: 'Age', type: 'number' },
    website: { label: 'Website', type: 'url' },
    password: Password,
    terms: {
      label: 'I agree to the terms of service',
      type: 'checkbox',
      schema: s.literal(true),
      errorMap({ code }) {
        if (code === 'value.required') return 'You must agree to the terms of service'
      },
    },
  },
})
