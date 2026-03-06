import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { sql } from 'remix/data-table'
import { loadMigrations } from 'remix/data-table/migrations/node'

import { db, initializeBookstoreDatabase } from './setup.ts'

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

describe('bookstore database setup', () => {
  it('applies migrations and materializes expected schema artifacts', async () => {
    await initializeBookstoreDatabase()

    let migrationsPath = fileURLToPath(new URL('../../data/migrations/', import.meta.url))
    let migrations = await loadMigrations(migrationsPath)

    let journalResult = await db.exec(
      sql`select id, name from data_table_migrations order by id asc`,
    )
    let journalRows = getRows(journalResult)
    let journalIds = journalRows.map((row) => readRowString(row, 'id'))
    let migrationIds = migrations.map((migration) => migration.id)

    assert.equal(journalRows.length, migrations.length)
    assert.deepEqual(journalIds, migrationIds)

    assert.equal(await db.adapter.hasTable({ name: 'books' }), true)
    assert.equal(await db.adapter.hasTable({ name: 'users' }), true)
    assert.equal(await db.adapter.hasTable({ name: 'orders' }), true)
    assert.equal(await db.adapter.hasTable({ name: 'order_items' }), true)
    assert.equal(await db.adapter.hasTable({ name: 'password_reset_tokens' }), true)

    assert.equal(await db.adapter.hasColumn({ name: 'books' }, 'slug'), true)
    assert.equal(await db.adapter.hasColumn({ name: 'users' }, 'email'), true)
    assert.equal(await db.adapter.hasColumn({ name: 'orders' }, 'user_id'), true)

    let ordersIndex = await db.exec(
      sql`select name from sqlite_master where type = 'index' and name = 'orders_user_id_idx'`,
    )
    let orderItemsOrderIndex = await db.exec(
      sql`select name from sqlite_master where type = 'index' and name = 'order_items_order_id_idx'`,
    )

    assert.equal(getRows(ordersIndex).length, 1)
    assert.equal(getRows(orderItemsOrderIndex).length, 1)
  })

  it('does not duplicate migration journal entries when initialized more than once', async () => {
    await initializeBookstoreDatabase()

    let before = await db.exec(sql`select count(*) as count from data_table_migrations`)
    let beforeRows = getRows(before)
    assert.ok(beforeRows.length > 0)
    let beforeCount = readRowCount(beforeRows[0], 'count')

    await initializeBookstoreDatabase()

    let after = await db.exec(sql`select count(*) as count from data_table_migrations`)
    let afterRows = getRows(after)
    assert.ok(afterRows.length > 0)
    let afterCount = readRowCount(afterRows[0], 'count')

    assert.equal(afterCount, beforeCount)
  })
})
