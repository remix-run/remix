import { describe } from '@remix-run/test'

import { runAdapterIntegrationContract } from '../../../data-table/test/adapter-integration-contract.ts'

import { createMysqlDatabase } from './database.ts'

const DATABASE_URL = process.env.REMIX_DATA_TABLE_MYSQL_TEST_URL

describe('mysql adapter integration', { skip: typeof DATABASE_URL !== 'string' }, () => {
  runAdapterIntegrationContract(createMysqlDatabase({ url: DATABASE_URL! }))
})
