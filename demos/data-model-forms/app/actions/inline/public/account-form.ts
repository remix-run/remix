import * as s from 'remix/data-schema'
import { email, maxLength, minLength } from 'remix/data-schema/checks'
import { createForm } from '@remix-run/ui/form'

export const AccountForm = createForm({
  fields: {
    displayName: {
      label: 'Display name',
      type: 'text',
      schema: s
        .string()
        .pipe(minLength(2), maxLength(50))
        .refine((value) => value.trim() === value),
      errorMap({ code }) {
        if (code === 'value.required') return 'Enter your display name'
        if (code === 'string.min_length') return 'Use at least 2 characters for your display name'
        if (code === 'refine.failed') return 'Enter your display name without extra spaces'
      },
    },
    email: {
      label: 'Email address',
      type: 'email',
      schema: s.string().pipe(email()),
    },
  },
})
