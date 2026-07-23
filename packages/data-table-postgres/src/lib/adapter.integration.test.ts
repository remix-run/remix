import * as assert from '@remix-run/assert'
import { after, before, describe, it } from '@remix-run/test'
import { createDatabase } from '@remix-run/data-table'
import { Pool } from 'pg'

import {
  resetAdapterIntegrationSchema,
  setupAdapterIntegrationSchema,
  teardownAdapterIntegrationSchema,
} from '../../../data-table/test/adapter-integration-schema.ts'
import { runAdapterIntegrationContract } from '../../../data-table/test/adapter-integration-contract.ts'

import { createPostgresDatabaseAdapter } from './adapter.ts'

const DATABASE_URL = process.env.REMIX_DATA_TABLE_POSTGRES_TEST_URL
const WIPE_DATABASE = 'data_table_wipe_test'

describe('postgres adapter integration', { skip: typeof DATABASE_URL !== 'string' }, () => {
  let pool: Pool

  before(async () => {
    pool = new Pool({ connectionString: DATABASE_URL! })
    await setupAdapterIntegrationSchema(async (statement) => {
      await pool.query(statement)
    }, 'postgres')
  })

  after(async () => {
    await teardownAdapterIntegrationSchema(async (statement) => {
      await pool.query(statement)
    }, 'postgres')
    await pool.end()
  })

  runAdapterIntegrationContract({
    createDatabase: () =>
      createDatabase(createPostgresDatabaseAdapter({ connectionString: DATABASE_URL! })),
    resetDatabase: async () => {
      await resetAdapterIntegrationSchema(async (statement) => {
        await pool.query(statement)
      }, 'postgres')
    },
  })

  it('wipes the configured database and reconnects', async () => {
    await pool.query(
      'select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()',
      [WIPE_DATABASE],
    )
    await pool.query('drop database if exists ' + WIPE_DATABASE)
    await pool.query('create database ' + WIPE_DATABASE)

    let db = createDatabase(
      createPostgresDatabaseAdapter({
        connectionString: DATABASE_URL!,
        database: WIPE_DATABASE,
      }),
    )

    try {
      await db.exec('create table users (id integer primary key)')

      await db.wipe()

      assert.equal(await db.adapter.hasTable({ name: 'users' }), false)
    } finally {
      await db.wipe()
      await pool.query('drop database if exists ' + WIPE_DATABASE)
    }
  })
})
