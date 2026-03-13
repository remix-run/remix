import { after, before, describe } from 'node:test'
import { createDatabase } from '@remix-run/data-table'

import { runJobStorageContract } from '../../../job/src/lib/test/storage-contract.ts'

import { createDataTableJobStorage } from './storage.ts'
import {
  DEFAULT_TEST_TABLE_PREFIX,
  resetJobStorageSchema,
  setupJobStorageSchema,
} from './test/schema.ts'

import type { Pool } from 'mysql2/promise'

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

    let [{ createMysqlDatabaseAdapter }, mysql] = await Promise.all([
      import('@remix-run/data-table-mysql'),
      import('mysql2/promise'),
    ])

    pool = mysql.createPool(process.env.JOB_DATA_TABLE_MYSQL_URL as string)
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
      createDataTableJobStorage(database, { tablePrefix: DEFAULT_TEST_TABLE_PREFIX }),
  })
})
