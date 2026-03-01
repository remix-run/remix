import { after, before, describe } from 'node:test'
import BetterSqlite3, { type Database as BetterSqliteDatabase } from 'better-sqlite3'
import { createDatabase } from '@remix-run/data-table'
import { createSqliteDatabaseAdapter } from '@remix-run/data-table-sqlite'

import { runJobStorageContract } from '../../../job/src/lib/test/storage-contract.ts'

import { createDataTableJobStorage } from './storage.ts'
import {
  DEFAULT_TEST_TABLE_PREFIX,
  resetJobStorageSchema,
  setupJobStorageSchema,
} from './test/schema.ts'

let integrationEnabled = canOpenSqliteDatabase()

describe('data-table job storage (sqlite)', () => {
  let sqlite: BetterSqliteDatabase
  let database: ReturnType<typeof createDatabase>

  before(async () => {
    if (!integrationEnabled) {
      return
    }

    sqlite = new BetterSqlite3(':memory:')
    database = createDatabase(createSqliteDatabaseAdapter(sqlite))
    await setupJobStorageSchema(database, DEFAULT_TEST_TABLE_PREFIX)
    await resetJobStorageSchema(database, DEFAULT_TEST_TABLE_PREFIX)
  })

  after(async () => {
    if (!integrationEnabled) {
      return
    }

    sqlite.close()
  })

  runJobStorageContract('sqlite contract', {
    integrationEnabled,
    setup: async () => {
      await resetJobStorageSchema(database, DEFAULT_TEST_TABLE_PREFIX)
    },
    createStorage: async () =>
      createDataTableJobStorage({
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
