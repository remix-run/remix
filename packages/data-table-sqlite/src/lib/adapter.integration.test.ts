import { after, before, describe } from '@remix-run/test'
import type { Database, DatabaseResource } from '@remix-run/data-table'

import {
  setupAdapterIntegrationSchema,
  teardownAdapterIntegrationSchema,
} from '../../../data-table/test/adapter-integration-schema.ts'
import { runAdapterIntegrationContract } from '../../../data-table/test/adapter-integration-contract.ts'

import { createSqliteDatabase } from './database.ts'

describe(
  'sqlite adapter integration',
  { skip: process.env.REMIX_DATA_TABLE_SQLITE_TEST !== '1' },
  () => {
    let database: DatabaseResource
    let client: Database

    before(async () => {
      database = createSqliteDatabase({ path: ':memory:' })
      client = await database.connect()
      await setupAdapterIntegrationSchema(async (statement) => {
        await client.exec(statement)
      }, 'sqlite')
    })

    after(async () => {
      await teardownAdapterIntegrationSchema(async (statement) => {
        await client.exec(statement)
      }, 'sqlite')
      await client.close()
      await database.close()
    })

    runAdapterIntegrationContract({
      getDatabase: () => client,
    })
  },
)
