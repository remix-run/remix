import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { number, string } from '@remix-run/data-schema'
import Database from 'better-sqlite3'
import { createDatabase, createTable, eq } from '@remix-run/data-table'

import { createSqliteDatabaseAdapter } from './adapter.ts'

let Accounts = createTable({
  name: 'accounts',
  columns: {
    id: number(),
    email: string(),
    status: string(),
  },
})

let Projects = createTable({
  name: 'projects',
  columns: {
    id: number(),
    account_id: number(),
    name: string(),
  },
})

let sqliteAvailable = canOpenSqliteDatabase()

describe('sqlite adapter', { skip: !sqliteAvailable }, () => {
  it('supports typed writes, reads, and nested transactions', async () => {
    let sqlite = new Database(':memory:')
    sqlite.exec(
      'create table accounts (id integer primary key, email text not null, status text not null)',
    )

    let db = createDatabase(createSqliteDatabaseAdapter(sqlite))

    await db.query(Accounts).insert({ id: 1, email: 'a@example.com', status: 'active' })

    await db.transaction(async function (outerTransaction) {
      await outerTransaction
        .query(Accounts)
        .insert({ id: 2, email: 'b@example.com', status: 'active' })

      await outerTransaction
        .transaction(async function (innerTransactionDatabase) {
          await innerTransactionDatabase
            .query(Accounts)
            .insert({ id: 3, email: 'c@example.com', status: 'active' })

          throw new Error('rollback inner')
        })
        .catch(function swallow() {
          return undefined
        })
    })

    let rows = await db.query(Accounts).orderBy('id', 'asc').all()
    let count = await db.query(Accounts).count()

    assert.equal(count, 2)
    assert.deepEqual(
      rows.map(function mapRow(row) {
        return row.id
      }),
      [1, 2],
    )

    sqlite.close()
  })

  it('supports upsert and returning', async () => {
    let sqlite = new Database(':memory:')
    sqlite.exec(
      'create table accounts (id integer primary key, email text not null, status text not null)',
    )

    let db = createDatabase(createSqliteDatabaseAdapter(sqlite))

    await db.query(Accounts).insert({ id: 1, email: 'a@example.com', status: 'active' })

    let result = await db
      .query(Accounts)
      .upsert(
        { id: 1, email: 'a@example.com', status: 'inactive' },
        { conflictTarget: ['id'], returning: ['id', 'status'] },
      )

    assert.ok('row' in result)
    if ('row' in result) {
      assert.equal(result.row?.status, 'inactive')
    }

    sqlite.close()
  })

  it('supports column-to-column comparisons from string references', async () => {
    let sqlite = new Database(':memory:')
    sqlite.exec(
      'create table accounts (id integer primary key, email text not null, status text not null)',
    )
    sqlite.exec(
      'create table projects (id integer primary key, account_id integer not null, name text not null)',
    )

    let db = createDatabase(createSqliteDatabaseAdapter(sqlite))

    await db.query(Accounts).insert({ id: 1, email: 'a@example.com', status: 'active' })
    await db.query(Projects).insert({ id: 10, account_id: 1, name: 'Alpha' })
    await db.query(Projects).insert({ id: 11, account_id: 99, name: 'Beta' })

    let count = await db
      .query(Accounts)
      .join(Projects, eq('accounts.id', 'projects.account_id'))
      .where(eq('accounts.email', 'a@example.com'))
      .count()

    assert.equal(count, 1)
    sqlite.close()
  })
})

function canOpenSqliteDatabase(): boolean {
  try {
    let database = new Database(':memory:')
    database.close()
    return true
  } catch {
    return false
  }
}
