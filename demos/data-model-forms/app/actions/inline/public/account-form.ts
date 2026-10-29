import * as s from 'remix/data-schema'
import * as fd from 'remix/data-schema/form'
import { email, maxLength, minLength } from 'remix/data-schema/checks'

export const AccountForm = fd.object({
  displayName: fd.text(
    s
      .string()
      .pipe(minLength(2), maxLength(50))
      .refine((value) => value.trim() === value),
    {
      errorMap({ code }) {
        if (code === 'value.required') return 'Enter your display name'
        if (code === 'string.min_length') return 'Use at least 2 characters for your display name'
        if (code === 'refine.failed') return 'Enter your display name without extra spaces'
      },
    },
  ),
  email: fd.text(s.string().pipe(email())),
})
