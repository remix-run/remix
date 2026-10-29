import * as s from 'remix/data-schema'
import * as fd from 'remix/data-schema/form'
import { minLength } from 'remix/data-schema/checks'

export const AccountSettingsForm = fd.object({
  name: fd.text(s.string()),
  email: fd.text(s.string()),
  password: fd.password(s.defaulted(s.union([s.literal(''), s.string().pipe(minLength(8))]), '')),
})
