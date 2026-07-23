import * as s from 'remix/data-schema'
import { email, max, maxLength, min, minLength, url } from 'remix/data-schema/checks'

export const Account = s.object({
  id: s.string(),
  displayName: s.string().pipe(minLength(2), maxLength(50)),
  email: s.string().pipe(email()),
  age: s.optional(s.number().pipe(min(18), max(120))),
  website: s.optional(s.string().pipe(url())),
})
