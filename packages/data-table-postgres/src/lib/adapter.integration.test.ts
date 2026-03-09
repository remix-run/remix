import { after, before, describe } from 'node:test'
import { createDatabase } from '@remix-run/data-table'
import { Pool } from 'pg'

import {
  resetAdapterIntegrationSchema,
  setupAdapterIntegrationSchema,
  teardownAdapterIntegrationSchema,
} from '../../../data-table/test/adapter-integration-schema.ts'
import { runAdapterIntegrationContract } from '../../../data-table/test/adapter-integration-contract.ts'

import { createPostgresDatabaseAdapter } from './adapter.ts'

let integrationEnabled =
  process.env.DATA_TABLE_INTEGRATION === '1' &&
  typeof process.env.DATA_TABLE_POSTGRES_URL === 'string'

describe('postgres adapter integration', () => {
  let pool: Pool

  before(async () => {
    if (!integrationEnabled) {
      return
    }

    pool = new Pool({ connectionString: process.env.DATA_TABLE_POSTGRES_URL })
    await setupAdapterIntegrationSchema(async (statement) => {
      await pool.query(statement)
    }, 'postgres')
  })

  after(async () => {
    if (!integrationEnabled) {
      return
    }

    await teardownAdapterIntegrationSchema(async (statement) => {
      await pool.query(statement)
    }, 'postgres')
    await pool.end()
  })

  runAdapterIntegrationContract({
    integrationEnabled,
    createDatabase: () => createDatabase(createPostgresDatabaseAdapter(pool)),
    resetDatabase: async () => {
      await resetAdapterIntegrationSchema(async (statement) => {
        await pool.query(statement)
      }, 'postgres')
    },
  })
})
