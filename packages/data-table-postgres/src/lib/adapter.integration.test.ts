import { describe } from '@remix-run/test'

import { runAdapterIntegrationContract } from '../../../data-table/test/adapter-integration-contract.ts'

import { createPostgresDatabase } from './database.ts'

const DATABASE_URL = process.env.REMIX_DATA_TABLE_POSTGRES_TEST_URL

describe('postgres adapter integration', { skip: typeof DATABASE_URL !== 'string' }, () => {
  runAdapterIntegrationContract(createPostgresDatabase({ url: DATABASE_URL! }))
})
