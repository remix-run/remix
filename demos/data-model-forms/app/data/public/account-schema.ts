import * as s from 'remix/data-schema'
import { email, max, maxLength, min, minLength, url } from 'remix/data-schema/checks'

export const DisplayNameSchema = s
  .string()
  .pipe(minLength(2), maxLength(50))
  .refine((value) => value.trim() === value, 'Remove leading or trailing spaces')

export const EmailSchema = s.string().pipe(email())

export const Account = s.object({
  id: s.string(),
  displayName: DisplayNameSchema,
  email: EmailSchema,
  age: s.optional(s.number().pipe(min(18), max(120))),
  website: s.optional(s.string().pipe(url())),
})
