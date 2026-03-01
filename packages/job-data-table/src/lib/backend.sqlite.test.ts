import { after, before, describe } from 'node:test'
import BetterSqlite3, { type Database as BetterSqliteDatabase } from 'better-sqlite3'
import { createDatabase } from '@remix-run/data-table'
import { createSqliteDatabaseAdapter } from '@remix-run/data-table-sqlite'

import { runJobBackendContract } from '../../../job/src/lib/test/backend-contract.ts'

import { createDataTableJobBackend } from './backend.ts'
import {
  DEFAULT_TEST_TABLE_PREFIX,
  resetJobBackendSchema,
  setupJobBackendSchema,
} from './test/schema.ts'

let integrationEnabled = canOpenSqliteDatabase()

describe('data-table job backend (sqlite)', () => {
  let sqlite: BetterSqliteDatabase
  let database: ReturnType<typeof createDatabase>

  before(async () => {
    if (!integrationEnabled) {
      return
    }

    sqlite = new BetterSqlite3(':memory:')
    database = createDatabase(createSqliteDatabaseAdapter(sqlite))
    await setupJobBackendSchema(database, DEFAULT_TEST_TABLE_PREFIX)
    await resetJobBackendSchema(database, DEFAULT_TEST_TABLE_PREFIX)
  })

  after(async () => {
    if (!integrationEnabled) {
      return
    }

    sqlite.close()
  })

  runJobBackendContract('sqlite contract', {
    integrationEnabled,
    setup: async () => {
      await resetJobBackendSchema(database, DEFAULT_TEST_TABLE_PREFIX)
    },
    createBackend: async () =>
      createDataTableJobBackend({
        db: database,
        tablePrefix: DEFAULT_TEST_TABLE_PREFIX,
      }),
  })
})

function canOpenSqliteDatabase(): boolean {
  try {
    let database = new BetterSqlite3(':memory:')
    database.close()
    return true
  } catch {
    return false
  }
}
