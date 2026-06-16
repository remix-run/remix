import { describe } from '@remix-run/test'

import { runAdapterIntegrationContract } from '../../../data-table/test/adapter-integration-contract.ts'

import { createSqliteDatabase } from './database.ts'

describe(
  'sqlite adapter integration',
  { skip: process.env.REMIX_DATA_TABLE_SQLITE_TEST !== '1' },
  () => {
    runAdapterIntegrationContract(createSqliteDatabase({ path: ':memory:' }))
  },
)
