import * as s from 'remix/data-schema'
import * as fd from 'remix/data-schema/form'
import { maxLength, minLength } from 'remix/data-schema/checks'
import { Account } from '../../../data/public/account-schema.ts'

export const RegistrationForm = fd.object({
  displayName: fd.text(Account.shape.displayName, {
    errorMap({ code }) {
      if (code === 'value.required') return 'Enter your display name'
      if (code === 'string.min_length') return 'Use at least 2 characters for your display name'
    },
  }),
  email: fd.text(Account.shape.email),
  age: fd.number(Account.shape.age),
  website: fd.text(Account.shape.website),
  password: fd.password(s.string().pipe(minLength(8), maxLength(72)), {
    errorMap({ code }) {
      if (code === 'value.required') return 'Enter your password'
      if (code === 'string.min_length') return 'password must be 8+ characters'
    },
  }),
  terms: fd.checkbox(s.literal(true), {
    errorMap({ code }) {
      if (code === 'value.required') return 'You must agree to the terms of service'
    },
  }),
})
