import * as assert from '@remix-run/assert'
import { after, before, describe, it } from '@remix-run/test'
import { createPool, type Pool } from 'mysql2/promise'

import {
  resetDriverIntegrationSchema,
  setupDriverIntegrationSchema,
  teardownDriverIntegrationSchema,
} from '../../../data-table/test/driver-integration-schema.ts'
import { runDriverIntegrationContract } from '../../../data-table/test/driver-integration-contract.ts'

import { createMysqlDatabase } from './database.ts'

const DATABASE_URL = process.env.REMIX_DATA_TABLE_MYSQL_TEST_URL

describe('mysql driver integration', { skip: typeof DATABASE_URL !== 'string' }, () => {
  let pool: Pool

  before(async () => {
    pool = createPool(DATABASE_URL!)
    await setupDriverIntegrationSchema(async (statement) => {
      await pool.query(statement)
    }, 'mysql')
  })

  after(async () => {
    await teardownDriverIntegrationSchema(async (statement) => {
      await pool.query(statement)
    }, 'mysql')
    await pool.end()
  })

  runDriverIntegrationContract({
    createDatabase: () => createMysqlDatabase(DATABASE_URL!),
    resetDatabase: async () => {
      await resetDriverIntegrationSchema(async (statement) => {
        await pool.query(statement)
      }, 'mysql')
    },
    supportsReturning: false,
  })

  it('runs migrations through a single-connection pool without deadlocking', async () => {
    let migrationPool = createPool({
      uri: DATABASE_URL!,
      connectionLimit: 1,
      multipleStatements: true,
    })
    let db = createMysqlDatabase(migrationPool)
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
    let db = createMysqlDatabase({ uri: DATABASE_URL! })
    await db.exec('create table data_table_wipe_test (id integer primary key)')

    await db.wipe()

    assert.equal(await db.hasTable({ name: 'data_table_wipe_test' }), false)
  })
})
