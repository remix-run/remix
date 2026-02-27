import { after, before, describe } from 'node:test'
import { createDatabase } from '@remix-run/data-table'
import { createMysqlDatabaseAdapter } from '@remix-run/data-table-mysql'
import { createPool, type Pool } from 'mysql2/promise'

import { runJobBackendContract } from '../../../job/src/lib/test/backend-contract.ts'

import { createDataTableJobBackend } from './backend.ts'
import { DEFAULT_TEST_TABLE_PREFIX, resetJobBackendSchema } from './test/schema.ts'

let integrationEnabled =
  process.env.JOB_DATA_TABLE_INTEGRATION === '1' &&
  typeof process.env.JOB_DATA_TABLE_MYSQL_URL === 'string'

describe('data-table job backend (mysql integration)', () => {
  let pool: Pool
  let database: ReturnType<typeof createDatabase>

  before(async () => {
    if (!integrationEnabled) {
      return
    }

    pool = createPool(process.env.JOB_DATA_TABLE_MYSQL_URL as string)
    database = createDatabase(createMysqlDatabaseAdapter(pool))
    await resetJobBackendSchema(async (statement) => {
      await pool.query(statement)
    }, 'mysql', DEFAULT_TEST_TABLE_PREFIX)
  })

  after(async () => {
    if (!integrationEnabled) {
      return
    }

    await pool.end()
  })

  runJobBackendContract('mysql contract', {
    integrationEnabled,
    setup: async () => {
      await resetJobBackendSchema(async (statement) => {
        await pool.query(statement)
      }, 'mysql', DEFAULT_TEST_TABLE_PREFIX)
    },
    createBackend: async () =>
      createDataTableJobBackend({
        db: database,
        dialect: 'mysql',
        tablePrefix: DEFAULT_TEST_TABLE_PREFIX,
      }),
  })
})
