import { after, before, describe } from '@remix-run/test'
import { createDatabase } from '@remix-run/data-table'

import {
  resetAdapterIntegrationSchema,
  setupAdapterIntegrationSchema,
  teardownAdapterIntegrationSchema,
} from '../../../data-table/test/adapter-integration-schema.ts'
import { runAdapterIntegrationContract } from '../../../data-table/test/adapter-integration-contract.ts'

import { createD1DatabaseAdapter } from './adapter.ts'
import { createTestD1Database, type TestD1Database } from './test-d1.test-helper.ts'

const integrationEnabled = true

describe('d1 adapter integration', () => {
  let database: TestD1Database

  before(async () => {
    database = await createTestD1Database()
    await setupAdapterIntegrationSchema(runStatement, 'sqlite')
  })

  after(async () => {
    await teardownAdapterIntegrationSchema(runStatement, 'sqlite')
    await database.dispose()
  })

  runAdapterIntegrationContract({
    integrationEnabled,
    supportsTransactions: false,
    createDatabase: () => createDatabase(createD1DatabaseAdapter(database)),
    resetDatabase: async () => {
      await resetAdapterIntegrationSchema(runStatement, 'sqlite')
    },
  })

  async function runStatement(statement: string): Promise<void> {
    await database.prepare(statement).run()
  }
})
