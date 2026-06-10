import { after, before, describe } from '@remix-run/test'
import { createDatabase } from '@remix-run/data-table'
import { createPool, type Pool } from 'mysql2/promise'

import {
  resetAdapterIntegrationSchema,
  setupAdapterIntegrationSchema,
  teardownAdapterIntegrationSchema,
} from '../../../data-table/test/adapter-integration-schema.ts'
import { runAdapterIntegrationContract } from '../../../data-table/test/adapter-integration-contract.ts'

import { createMysqlDatabaseAdapter } from './adapter.ts'

const DATABASE_URL = process.env.REMIX_DATA_TABLE_MYSQL_TEST_URL
const integrationEnabled = typeof DATABASE_URL === 'string'

describe('mysql adapter integration', () => {
  let pool: Pool

  before(async () => {
    if (!integrationEnabled) {
      return
    }

    pool = createPool(DATABASE_URL)
    await setupAdapterIntegrationSchema(async (statement) => {
      await pool.query(statement)
    }, 'mysql')
  })

  after(async () => {
    if (!integrationEnabled) {
      return
    }

    await teardownAdapterIntegrationSchema(async (statement) => {
      await pool.query(statement)
    }, 'mysql')
    await pool.end()
  })

  runAdapterIntegrationContract({
    integrationEnabled,
    createDatabase: () => createDatabase(createMysqlDatabaseAdapter(pool)),
    resetDatabase: async () => {
      await resetAdapterIntegrationSchema(async (statement) => {
        await pool.query(statement)
      }, 'mysql')
    },
  })
})
