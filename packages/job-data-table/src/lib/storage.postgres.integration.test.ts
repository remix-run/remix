import { after, before, describe } from '@remix-run/test'
import { createDatabase } from '@remix-run/data-table'
import { createPostgresDatabaseAdapter } from '@remix-run/data-table-postgres'
import { Pool } from 'pg'

import { runJobStorageContract } from '../../../job/src/lib/test/storage-contract.ts'

import { createDataTableJobStorage } from './storage.ts'
import {
  DEFAULT_TEST_TABLE_PREFIX,
  resetJobStorageSchema,
  setupJobStorageSchema,
} from './test/schema.ts'

let integrationEnabled =
  process.env.DATA_TABLE_INTEGRATION === '1' &&
  typeof process.env.DATA_TABLE_POSTGRES_URL === 'string'

describe('data-table job storage (postgres integration)', () => {
  let pool: Pool
  let database: ReturnType<typeof createDatabase>

  before(async () => {
    if (!integrationEnabled) {
      return
    }

    pool = new Pool({
      connectionString: process.env.DATA_TABLE_POSTGRES_URL,
    })
    database = createDatabase(createPostgresDatabaseAdapter(pool))
    await setupJobStorageSchema(database, DEFAULT_TEST_TABLE_PREFIX)
    await resetJobStorageSchema(database, DEFAULT_TEST_TABLE_PREFIX)
  })

  after(async () => {
    if (!integrationEnabled) {
      return
    }

    await pool.end()
  })

  runJobStorageContract('postgres contract', {
    integrationEnabled,
    setup: async () => {
      await resetJobStorageSchema(database, DEFAULT_TEST_TABLE_PREFIX)
    },
    createStorage: async () =>
      createDataTableJobStorage(database, { tablePrefix: DEFAULT_TEST_TABLE_PREFIX }),
  })
})
