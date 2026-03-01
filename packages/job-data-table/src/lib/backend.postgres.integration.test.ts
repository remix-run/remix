import { after, before, describe } from 'node:test'
import { createDatabase } from '@remix-run/data-table'
import { createPostgresDatabaseAdapter } from '@remix-run/data-table-postgres'
import { Pool } from 'pg'

import { runJobBackendContract } from '../../../job/src/lib/test/backend-contract.ts'

import { createDataTableJobBackend } from './backend.ts'
import {
  DEFAULT_TEST_TABLE_PREFIX,
  resetJobBackendSchema,
  setupJobBackendSchema,
} from './test/schema.ts'

let integrationEnabled =
  process.env.JOB_DATA_TABLE_INTEGRATION === '1' &&
  typeof process.env.JOB_DATA_TABLE_POSTGRES_URL === 'string'

describe('data-table job backend (postgres integration)', () => {
  let pool: Pool
  let database: ReturnType<typeof createDatabase>

  before(async () => {
    if (!integrationEnabled) {
      return
    }

    pool = new Pool({
      connectionString: process.env.JOB_DATA_TABLE_POSTGRES_URL,
    })
    database = createDatabase(createPostgresDatabaseAdapter(pool))
    await setupJobBackendSchema(database, DEFAULT_TEST_TABLE_PREFIX)
    await resetJobBackendSchema(database, DEFAULT_TEST_TABLE_PREFIX)
  })

  after(async () => {
    if (!integrationEnabled) {
      return
    }

    await pool.end()
  })

  runJobBackendContract('postgres contract', {
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
