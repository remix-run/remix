import { after, before, describe } from '@remix-run/test'
import { createDatabase } from '@remix-run/data-table'

import {
  resetAdapterIntegrationSchema,
  setupAdapterIntegrationSchema,
  teardownAdapterIntegrationSchema,
} from '../../../data-table/test/adapter-integration-schema.ts'
import { runAdapterIntegrationContract } from '../../../data-table/test/adapter-integration-contract.ts'
import { createNativeSqliteDatabase, type NativeSqliteDatabase } from '../../test/native-sqlite.ts'

import { SqliteDatabaseAdapter } from './adapter.ts'

describe(
  'sqlite adapter integration',
  { skip: process.env.REMIX_DATA_TABLE_SQLITE_TEST !== '1' },
  () => {
    let sqlite: NativeSqliteDatabase

    before(async () => {
      sqlite = createNativeSqliteDatabase()
      await setupAdapterIntegrationSchema(async (statement) => {
        sqlite.exec(statement)
      }, 'sqlite')
    })

    after(async () => {
      await teardownAdapterIntegrationSchema(async (statement) => {
        sqlite.exec(statement)
      }, 'sqlite')
      sqlite.close()
    })

    runAdapterIntegrationContract({
      createDatabase: () => createDatabase(new SqliteDatabaseAdapter(sqlite)),
      resetDatabase: async () => {
        await resetAdapterIntegrationSchema(async (statement) => {
          sqlite.exec(statement)
        }, 'sqlite')
      },
    })
  },
)
