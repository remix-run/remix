import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { sql } from 'remix/data-table'
import { loadMigrations } from 'remix/data-table/migrations/node'

import { db, initializeSocialLoginDatabase } from './setup.ts'

function getRows(result: { rows?: Record<string, unknown>[] }): Record<string, unknown>[] {
  return result.rows ?? []
}

function readRowString(row: Record<string, unknown>, key: string): string {
  let value = row[key]

  if (typeof value !== 'string') {
    throw new Error('Expected string row value for key "' + key + '"')
  }

  return value
}

function readRowCount(row: Record<string, unknown>, key: string): number {
  let value = row[key]

  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'bigint') {
    return Number(value)
  }

  if (typeof value === 'string') {
    return Number(value)
  }

  throw new Error('Expected numeric row value for key "' + key + '"')
}

describe('social login database setup', () => {
  it('applies migrations and materializes the expected schema', async () => {
    await initializeSocialLoginDatabase()

    let migrationsPath = fileURLToPath(new URL('../../data/migrations/', import.meta.url))
    let migrations = await loadMigrations(migrationsPath)

    let journalResult = await db.exec(
      sql`select id, name from data_table_migrations order by id asc`,
    )
    let journalRows = getRows(journalResult)
    let journalIds = journalRows.map(row => readRowString(row, 'id'))
    let migrationIds = migrations.map(migration => migration.id)

    assert.equal(journalRows.length, migrations.length)
    assert.deepEqual(journalIds, migrationIds)

    assert.equal(await db.adapter.hasTable({ name: 'users' }), true)
    assert.equal(await db.adapter.hasTable({ name: 'auth_accounts' }), true)
    assert.equal(await db.adapter.hasColumn({ name: 'users' }, 'email'), true)
    assert.equal(await db.adapter.hasColumn({ name: 'auth_accounts' }, 'provider_account_id'), true)

    let providerIndex = await db.exec(
      sql`select name from sqlite_master where type = 'index' and name = 'auth_accounts_provider_account_idx'`,
    )

    assert.equal(getRows(providerIndex).length, 1)
  })

  it('seeds the local email and password account once', async () => {
    await initializeSocialLoginDatabase()

    let before = await db.exec(sql`select count(*) as count from users`)
    let beforeRows = getRows(before)
    assert.ok(beforeRows.length > 0)
    let beforeCount = readRowCount(beforeRows[0], 'count')

    await initializeSocialLoginDatabase()

    let after = await db.exec(sql`select count(*) as count from users`)
    let afterRows = getRows(after)
    assert.ok(afterRows.length > 0)
    let afterCount = readRowCount(afterRows[0], 'count')

    assert.equal(afterCount, beforeCount)
    assert.equal(beforeCount, 1)
  })
})
