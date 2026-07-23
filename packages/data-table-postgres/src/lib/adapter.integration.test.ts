import * as assert from '@remix-run/assert'
import { after, before, describe, it } from '@remix-run/test'
import { createDatabase, createMigrationRunner } from '@remix-run/data-table'
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

  it('runs migrations through a single-connection pool without deadlocking', async () => {
    let migrationPool = new Pool({ connectionString: DATABASE_URL!, max: 1 })
    let adapter = createPostgresDatabaseAdapter(migrationPool)
    let runner = createMigrationRunner(
      adapter,
      [
        {
          id: '20260723000000',
          name: 'migration_lock_test',
          up: 'create table data_table_migration_lock_test (id integer primary key)',
          down: 'drop table data_table_migration_lock_test',
        },
      ],
      { journalTable: 'data_table_migration_lock_journal' },
    )

    try {
      await runner.up()
      assert.equal(await adapter.hasTable({ name: 'data_table_migration_lock_test' }), true)
      await runner.down()
    } finally {
      await migrationPool.query('drop table if exists data_table_migration_lock_test')
      await migrationPool.query('drop table if exists data_table_migration_lock_journal')
      await migrationPool.end()
    }
  })

  it('wipes the configured database and reconnects', async () => {
    await pool.query(
      'select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()',
      [WIPE_DATABASE],
    )
    await pool.query('drop database if exists ' + WIPE_DATABASE)
    await pool.query('create database ' + WIPE_DATABASE)

    let databaseUrl = new URL(DATABASE_URL!)
    databaseUrl.pathname = '/' + WIPE_DATABASE

    let db = createDatabase(
      createPostgresDatabaseAdapter({
        connectionString: databaseUrl.toString(),
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
