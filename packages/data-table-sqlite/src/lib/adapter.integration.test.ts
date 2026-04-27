import { after, before, describe } from '@remix-run/test'
import { createDatabase } from '@remix-run/data-table'

import {
  resetAdapterIntegrationSchema,
  setupAdapterIntegrationSchema,
  teardownAdapterIntegrationSchema,
} from '../../../data-table/test/adapter-integration-schema.ts'
import { runAdapterIntegrationContract } from '../../../data-table/test/adapter-integration-contract.ts'
import {
  createNativeSqliteDatabase,
  type NativeSqliteDatabase,
} from '../../../data-table/test/native-sqlite.ts'

import { createSqliteDatabaseAdapter } from './adapter.ts'

const integrationEnabled = process.env.DATA_TABLE_INTEGRATION === '1'

describe('sqlite adapter integration', () => {
  let sqlite: NativeSqliteDatabase

  before(async () => {
    if (!integrationEnabled) {
      return
    }

    sqlite = createNativeSqliteDatabase()
    await setupAdapterIntegrationSchema(async (statement) => {
      sqlite.exec(statement)
    }, 'sqlite')
  })

  after(async () => {
    if (!integrationEnabled) {
      return
    }

    await teardownAdapterIntegrationSchema(async (statement) => {
      sqlite.exec(statement)
    }, 'sqlite')
    sqlite.close()
  })

  runAdapterIntegrationContract({
    integrationEnabled,
    createDatabase: () => createDatabase(createSqliteDatabaseAdapter(sqlite)),
    resetDatabase: async () => {
      await resetAdapterIntegrationSchema(async (statement) => {
        sqlite.exec(statement)
      }, 'sqlite')
    },
  })
})
