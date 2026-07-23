import * as s from 'remix/data-schema'
import { email } from 'remix/data-schema/checks'

export const loginSchema = s.object({
  email: s.string().pipe(email()),
  password: s.string(),
})
