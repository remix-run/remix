import * as assert from 'remix/assert'
import { DataTableValidationError } from 'remix/data-table'
import { describe, it } from 'remix/test'

import { accounts } from './account.ts'
import { createDataModelFormsDatabase } from './database.ts'

describe('data model forms database', () => {
  it('stores account fields validated by the shared model', async () => {
    let db = createDataModelFormsDatabase()

    await db.create(accounts, {
      id: 'account-1',
      displayName: 'Ada Lovelace',
      email: 'ada@example.com',
    })

    let storedAccounts = await db.findMany(accounts)

    assert.deepEqual(storedAccounts, [
      {
        id: 'account-1',
        displayName: 'Ada Lovelace',
        email: 'ada@example.com',
        age: null,
        website: null,
      },
    ])
  })

  it('rejects writes that fail the shared model', async () => {
    let db = createDataModelFormsDatabase()

    await assert.rejects(
      () =>
        db.create(accounts, {
          id: 'account-1',
          displayName: 'A',
          email: 'not-an-email',
        }),
      (error: unknown) =>
        error instanceof DataTableValidationError && error.metadata?.source === 'validate',
    )
  })
})
