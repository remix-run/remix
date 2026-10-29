import * as fd from 'remix/data-schema/form'
import { DisplayNameSchema, EmailSchema } from '../../../data/public/account-schema.ts'

export const AccountForm = fd.object({
  displayName: fd.text(DisplayNameSchema),
  email: fd.text(EmailSchema),
})
