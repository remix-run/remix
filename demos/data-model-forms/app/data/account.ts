import * as s from 'remix/data-schema'
import { column as c, table } from 'remix/data-table'

import { Account } from './account-schema.ts'

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
    if (operation === 'update') {
      return { issues: [{ message: 'Account updates are not supported' }] }
    }

    let result = s.parseSafe(Account, value)

    if (!result.success) {
      return { issues: result.issues.map((issue) => ({ message: issue.message })) }
    }

    return { value: result.value }
  },
})
