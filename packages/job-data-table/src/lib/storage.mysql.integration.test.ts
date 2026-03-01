import { after, before, describe } from 'node:test'
import { createDatabase } from '@remix-run/data-table'
import { createMysqlDatabaseAdapter } from '@remix-run/data-table-mysql'
import { createPool, type Pool } from 'mysql2/promise'

import { runJobStorageContract } from '../../../job/src/lib/test/storage-contract.ts'

import { createDataTableJobStorage } from './storage.ts'
import {
  DEFAULT_TEST_TABLE_PREFIX,
  resetJobStorageSchema,
  setupJobStorageSchema,
} from './test/schema.ts'

let integrationEnabled =
  process.env.JOB_DATA_TABLE_INTEGRATION === '1' &&
  typeof process.env.JOB_DATA_TABLE_MYSQL_URL === 'string'

describe('data-table job storage (mysql integration)', () => {
  let pool: Pool
  let database: ReturnType<typeof createDatabase>

  before(async () => {
    if (!integrationEnabled) {
      return
    }

    pool = createPool(process.env.JOB_DATA_TABLE_MYSQL_URL as string)
    database = createDatabase(createMysqlDatabaseAdapter(pool))
    await setupJobStorageSchema(database, DEFAULT_TEST_TABLE_PREFIX)
    await resetJobStorageSchema(database, DEFAULT_TEST_TABLE_PREFIX)
  })

  after(async () => {
    if (!integrationEnabled) {
      return
    }

    await pool.end()
  })

  runJobStorageContract('mysql contract', {
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
