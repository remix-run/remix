import { after, before, describe } from '@remix-run/test'

import {
  resetDriverIntegrationSchema,
  setupDriverIntegrationSchema,
  teardownDriverIntegrationSchema,
} from '../../../data-table/test/driver-integration-schema.ts'
import { runDriverIntegrationContract } from '../../../data-table/test/driver-integration-contract.ts'
import { createNativeSqliteDatabase, type NativeSqliteDatabase } from '../../test/native-sqlite.ts'

import { createSqliteDatabase } from './database.ts'

describe(
  'sqlite driver integration',
  { skip: process.env.REMIX_DATA_TABLE_SQLITE_TEST !== '1' },
  () => {
    let sqlite: NativeSqliteDatabase

    before(async () => {
      sqlite = createNativeSqliteDatabase()
      await setupDriverIntegrationSchema(async (statement) => {
        sqlite.exec(statement)
      }, 'sqlite')
    })

    after(async () => {
      await teardownDriverIntegrationSchema(async (statement) => {
        sqlite.exec(statement)
      }, 'sqlite')
      sqlite.close()
    })

    runDriverIntegrationContract({
      createDatabase: () => createSqliteDatabase(sqlite),
      resetDatabase: async () => {
        await resetDriverIntegrationSchema(async (statement) => {
          sqlite.exec(statement)
        }, 'sqlite')
      },
    })
  },
)
