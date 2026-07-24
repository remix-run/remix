import * as assert from '@remix-run/assert'
import { after, before, describe, it } from '@remix-run/test'
import { Pool } from 'pg'

import {
  resetAdapterIntegrationSchema,
  setupAdapterIntegrationSchema,
  teardownAdapterIntegrationSchema,
} from '../../../data-table/test/adapter-integration-schema.ts'
import { runAdapterIntegrationContract } from '../../../data-table/test/adapter-integration-contract.ts'

import { createPostgresDatabase } from './database.ts'

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
    createDatabase: () => createPostgresDatabase({ connectionString: DATABASE_URL! }),
    resetDatabase: async () => {
      await resetAdapterIntegrationSchema(async (statement) => {
        await pool.query(statement)
      }, 'postgres')
    },
  })

  it('runs migrations through a single-connection pool without deadlocking', async () => {
    let migrationPool = new Pool({ connectionString: DATABASE_URL!, max: 1 })
    let db = createPostgresDatabase(migrationPool)
    let migrations = [
      {
        id: '20260723000000',
        name: 'migration_lock_test',
        up: 'create table data_table_migration_lock_test (id integer primary key)',
        down: 'drop table data_table_migration_lock_test',
      },
    ]

    try {
      await db.migrate(migrations, { journalTable: 'data_table_migration_lock_journal' })
      assert.equal(await db.hasTable({ name: 'data_table_migration_lock_test' }), true)
      await db.migrate(migrations, {
        direction: 'down',
        journalTable: 'data_table_migration_lock_journal',
      })
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

    let db = createPostgresDatabase({ connectionString: databaseUrl.toString() })

    try {
      await db.exec('create table users (id integer primary key)')

      await db.wipe()

      assert.equal(await db.hasTable({ name: 'users' }), false)
    } finally {
      await db.wipe()
      await pool.query('drop database if exists ' + WIPE_DATABASE)
    }
  })
})
