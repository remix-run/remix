import * as s from 'remix/data-schema'
import { email, max, maxLength, min, minLength, url } from 'remix/data-schema/checks'
import { column as c, table } from 'remix/data-table'

export const Account = s.object({
  id: s.string(),
  displayName: s.string().pipe(minLength(2), maxLength(50)),
  email: s.string().pipe(email()),
  age: s.optional(s.number().pipe(min(18), max(120))),
  website: s.optional(s.string().pipe(url())),
  password: s.string().pipe(minLength(8), maxLength(72)),
})

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
