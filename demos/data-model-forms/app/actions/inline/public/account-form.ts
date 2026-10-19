import * as s from 'remix/data-schema'
import { email, maxLength, minLength } from 'remix/data-schema/checks'
import { createForm } from 'remix/data-schema/form'

export const AccountForm = createForm({
  fields: {
    displayName: {
      label: 'Display name',
      type: 'text',
      schema: s
        .string()
        .pipe(minLength(2), maxLength(50))
        .refine((value) => value.trim() === value, 'Remove leading or trailing spaces'),
    },
    email: {
      label: 'Email address',
      type: 'email',
      schema: s.string().pipe(email()),
    },
  },
})
