import * as fd from 'remix/data-schema/form'
import { Account } from '../../../data/public/account-schema.ts'

export const AccountForm = fd.object({
  displayName: fd.text(Account.shape.displayName),
  email: fd.text(Account.shape.email),
  age: fd.number(Account.shape.age),
  website: fd.text(Account.shape.website),
})
