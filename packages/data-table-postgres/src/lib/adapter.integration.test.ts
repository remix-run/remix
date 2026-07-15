import { after, before, describe } from '@remix-run/test'
import { createDatabase } from '@remix-run/data-table'
import { Pool } from 'pg'

import {
  resetAdapterIntegrationSchema,
  setupAdapterIntegrationSchema,
  teardownAdapterIntegrationSchema,
} from '../../../data-table/test/adapter-integration-schema.ts'
import { runAdapterIntegrationContract } from '../../../data-table/test/adapter-integration-contract.ts'

import { createPostgresDatabaseAdapter } from './adapter.ts'

const DATABASE_URL = process.env.REMIX_DATA_TABLE_POSTGRES_TEST_URL

describe('postgres adapter integration', { skip: typeof DATABASE_URL !== 'string' }, () => {
  let pool: Pool

  before(async () => {
    pool = new Pool({ connectionString: DATABASE_URL! })
    await setupAdapterIntegrationSchema(async (statement) => {
      await pool.query(statement)
    }, 'postgres')
  })

  after(async () => {
    await teardownAdapterIntegrationSchema(async (statement) => {
      await pool.query(statement)
    }, 'postgres')
    await pool.end()
  })

  runAdapterIntegrationContract({
    createDatabase: () => createDatabase(createPostgresDatabaseAdapter(pool)),
    resetDatabase: async () => {
      await resetAdapterIntegrationSchema(async (statement) => {
        await pool.query(statement)
      }, 'postgres')
    },
  })
})
