import { after, before, describe } from 'node:test'
import BetterSqlite3, { type Database as BetterSqliteDatabase } from 'better-sqlite3'
import { createDatabase } from '@remix-run/data-table'

import {
  resetAdapterIntegrationSchema,
  setupAdapterIntegrationSchema,
  teardownAdapterIntegrationSchema,
} from '../../../data-table/test/adapter-integration-schema.ts'
import { runAdapterIntegrationContract } from '../../../data-table/test/adapter-integration-contract.ts'

import { createSqliteDatabaseAdapter } from './adapter.ts'

let integrationEnabled = process.env.DATA_TABLE_INTEGRATION === '1' && canOpenSqliteDatabase()

describe('sqlite adapter integration', () => {
  let sqlite: BetterSqliteDatabase

  before(async () => {
    if (!integrationEnabled) {
      return
    }

    sqlite = new BetterSqlite3(':memory:')
    await setupAdapterIntegrationSchema(
      async (statement) => {
        sqlite.exec(statement)
      },
      'sqlite',
    )
  })

  after(async () => {
    if (!integrationEnabled) {
      return
    }

    await teardownAdapterIntegrationSchema(
      async (statement) => {
        sqlite.exec(statement)
      },
      'sqlite',
    )
    sqlite.close()
  })

  runAdapterIntegrationContract({
    integrationEnabled,
    createDatabase: () => createDatabase(createSqliteDatabaseAdapter(sqlite)),
    resetDatabase: async () => {
      await resetAdapterIntegrationSchema(
        async (statement) => {
          sqlite.exec(statement)
        },
        'sqlite',
      )
    },
  })
})

function canOpenSqliteDatabase(): boolean {
  try {
    let database = new BetterSqlite3(':memory:')
    database.close()
    return true
  } catch {
    return false
  }
}
