import * as s from 'remix/data-schema'
import { column as c, table } from 'remix/data-table'

import { Account } from './account-schema.ts'

const StoredAccount = s.object({
  id: Account.shape.id,
  displayName: Account.shape.displayName,
  email: Account.shape.email,
  age: Account.shape.age,
  website: Account.shape.website,
})

const StoredAccountUpdate = s.object({
  id: s.optional(Account.shape.id),
  displayName: s.optional(Account.shape.displayName),
  email: s.optional(Account.shape.email),
  age: s.optional(Account.shape.age),
  website: s.optional(Account.shape.website),
})

export const accounts = table({
  name: 'accounts',
  columns: {
    id: c.text(),
    displayName: c.text(),
    email: c.text(),
    age: c.integer().nullable(),
    website: c.text().nullable(),
  },
  validate({ operation, value }) {
    let result = s.parseSafe(operation === 'create' ? StoredAccount : StoredAccountUpdate, value)

    if (!result.success) {
      return { issues: result.issues.map((issue) => ({ message: issue.message })) }
    }

    return { value: result.value }
  },
})
