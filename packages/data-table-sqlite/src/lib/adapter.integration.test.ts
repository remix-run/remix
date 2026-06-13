import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { after, before, describe } from '@remix-run/test'
import type { Database, DatabaseResource } from '@remix-run/data-table'

import {
  resetAdapterIntegrationSchema,
  setupAdapterIntegrationSchema,
  teardownAdapterIntegrationSchema,
} from '../../../data-table/test/adapter-integration-schema.ts'
import { runAdapterIntegrationContract } from '../../../data-table/test/adapter-integration-contract.ts'

import { createSqliteDatabase } from './database.ts'

describe(
  'sqlite adapter integration',
  { skip: process.env.REMIX_DATA_TABLE_SQLITE_TEST !== '1' },
  () => {
    let databaseDirectory: string
    let database: DatabaseResource
    let client: Database

    before(async () => {
      databaseDirectory = await mkdtemp(join(tmpdir(), 'remix-data-table-sqlite-'))
      database = createSqliteDatabase({ path: join(databaseDirectory, 'integration.sqlite') })
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
      await rm(databaseDirectory, { force: true, recursive: true })
    })

    runAdapterIntegrationContract({
      createDatabase: () => database.connect(),
      resetDatabase: async () => {
        await resetAdapterIntegrationSchema(async (statement) => {
          await client.exec(statement)
        }, 'sqlite')
      },
    })
  },
)
