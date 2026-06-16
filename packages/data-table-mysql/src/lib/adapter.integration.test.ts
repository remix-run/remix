import { after, before, describe } from '@remix-run/test'
import type { Database, DatabaseResource } from '@remix-run/data-table'

import {
  setupAdapterIntegrationSchema,
  teardownAdapterIntegrationSchema,
} from '../../../data-table/test/adapter-integration-schema.ts'
import { runAdapterIntegrationContract } from '../../../data-table/test/adapter-integration-contract.ts'

import { createMysqlDatabase } from './database.ts'

const DATABASE_URL = process.env.REMIX_DATA_TABLE_MYSQL_TEST_URL

describe('mysql adapter integration', { skip: typeof DATABASE_URL !== 'string' }, () => {
  let database: DatabaseResource
  let client: Database

  before(async () => {
    database = createMysqlDatabase({ url: DATABASE_URL! })
    client = await database.connect()
    await setupAdapterIntegrationSchema(async (statement) => {
      await client.exec(statement)
    }, 'mysql')
  })

  after(async () => {
    await teardownAdapterIntegrationSchema(async (statement) => {
      await client.exec(statement)
    }, 'mysql')
    await client.close()
    await database.close()
  })

  runAdapterIntegrationContract({
    getDatabase: () => client,
  })
})
