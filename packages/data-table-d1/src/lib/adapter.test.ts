import * as assert from '@remix-run/assert'
import { column, createDatabase, table } from '@remix-run/data-table'
import { describe, it } from '@remix-run/test'

import { createD1DatabaseAdapter } from './adapter.ts'
import { createTestD1Database } from './test-d1.test-helper.ts'

const accounts = table({
  name: 'accounts',
  columns: {
    id: column.integer(),
    email: column.text(),
    status: column.text(),
    created_at: column.text(),
  },
})

const accountProjects = table({
  name: 'account_projects',
  columns: {
    account_id: column.integer(),
    project_id: column.integer(),
  },
  primaryKey: ['account_id', 'project_id'],
})

describe('d1 adapter', () => {
  it('reports D1 capabilities', async () => {
    let database = await createTestD1Database()
    let adapter = createD1DatabaseAdapter(database)

    assert.equal(adapter.dialect, 'd1')
    assert.deepEqual(adapter.capabilities, {
      returning: true,
      savepoints: false,
      upsert: true,
      transactionalDdl: false,
      migrationLock: false,
    })
    await database.dispose()
  })

  it('short-circuits insertMany([]) and returns empty rows for returning queries', async () => {
    let database = await createTestD1Database()
    let adapter = createD1DatabaseAdapter(database)

    let result = await adapter.execute({
      operation: {
        kind: 'insertMany',
        table: accounts,
        values: [],
        returning: ['id'],
      },
      transaction: undefined,
    })

    assert.deepEqual(result, {
      affectedRows: 0,
      insertId: undefined,
      rows: [],
    })
    assert.equal(database.prepareCalls, 0)
    await database.dispose()
  })

  it('runs scripts and introspects tables and columns', async () => {
    let database = await createTestD1Database()
    let adapter = createD1DatabaseAdapter(database)

    await adapter.executeScript(
      'create table accounts (id integer primary key, email text not null, status text not null, created_at text)',
    )

    assert.equal(await adapter.hasTable({ name: 'accounts' }), true)
    assert.equal(await adapter.hasTable({ name: 'missing' }), false)
    assert.equal(await adapter.hasColumn({ name: 'accounts' }, 'email'), true)
    assert.equal(await adapter.hasColumn({ name: 'accounts' }, 'missing'), false)
    await database.dispose()
  })

  it('supports writes, returned rows, count normalization, and insert ids', async () => {
    let database = await createTestD1Database()
    let db = createDatabase(createD1DatabaseAdapter(database))

    await database.exec(
      'create table accounts (id integer primary key autoincrement, email text not null, status text not null, created_at text)',
    )

    let first = await db.create(
      accounts,
      { email: 'a@example.com', status: 'active', created_at: undefined },
      { returnRow: true },
    )
    let second = await db.create(accounts, { email: 'b@example.com', status: 'inactive' })
    let count = await db.count(accounts)

    assert.deepEqual(first, {
      id: 1,
      email: 'a@example.com',
      status: 'active',
      created_at: null,
    })
    assert.equal(second.insertId, 2)
    assert.equal(second.affectedRows, 1)
    assert.equal(count, 2)
    await database.dispose()
  })

  it('does not expose insertId for composite primary keys', async () => {
    let database = await createTestD1Database()
    let adapter = createD1DatabaseAdapter(database)

    await database.exec('create table account_projects (account_id integer, project_id integer)')

    let result = await adapter.execute({
      operation: {
        kind: 'insert',
        table: accountProjects,
        values: {
          account_id: 1,
          project_id: 2,
        },
      },
      transaction: undefined,
    })

    assert.equal(result.affectedRows, 1)
    assert.equal(result.insertId, undefined)
    await database.dispose()
  })

  it('normalizes D1 bound values and rejects unsupported values', async () => {
    let database = await createTestD1Database()
    let adapter = createD1DatabaseAdapter(database)
    let createdAt = new Date('2026-06-04T12:00:00.000Z')

    await database.exec(
      'create table accounts (id integer primary key, email text, status integer, created_at text)',
    )
    await adapter.execute({
      operation: {
        kind: 'insert',
        table: accounts,
        values: {
          id: 1,
          email: undefined,
          status: true,
          created_at: createdAt,
        },
      },
      transaction: undefined,
    })
    let row = await database.prepare('select * from accounts where id = ?').bind(1).first<{
      id: number
      email: string | null
      status: number
      created_at: string
    }>()

    assert.deepEqual(row, {
      id: 1,
      email: null,
      status: 1,
      created_at: '2026-06-04T12:00:00.000Z',
    })
    await assert.rejects(
      () =>
        adapter.execute({
          operation: {
            kind: 'insert',
            table: accounts,
            values: {
              id: 2n,
            },
          },
          transaction: undefined,
        }),
      /Unsupported D1 bound value: 2/,
    )
    await database.dispose()
  })

  it('rejects interactive transactions and transaction tokens', async () => {
    let database = await createTestD1Database()
    let adapter = createD1DatabaseAdapter(database)
    let db = createDatabase(adapter)

    await assert.rejects(
      () => db.transaction(async () => undefined),
      /D1DatabaseAdapter does not support data-table interactive transactions/,
    )
    await assert.rejects(
      () => adapter.commitTransaction({ id: 'tx_missing' }),
      /Unknown transaction token: tx_missing/,
    )
    await assert.rejects(
      () => adapter.rollbackTransaction({ id: 'tx_missing' }),
      /Unknown transaction token: tx_missing/,
    )
    await assert.rejects(
      () => adapter.createSavepoint({ id: 'tx_missing' }, 'sp'),
      /Unknown transaction token: tx_missing/,
    )
    await assert.rejects(() => database.prepare('begin').run(), /BEGIN TRANSACTION|SAVEPOINT/)
    await assert.rejects(() => database.prepare('savepoint sp').run(), /BEGIN TRANSACTION|SAVEPOINT/)
    await database.dispose()
  })

  it('rejects ordered and limited writes that require interactive transactions', async () => {
    let database = await createTestD1Database()
    let db = createDatabase(createD1DatabaseAdapter(database))

    await database.exec(
      'create table accounts (id integer primary key, email text not null, status text not null, created_at text)',
    )
    await db.query(accounts).insertMany([
      { id: 1, email: 'a@example.com', status: 'active' },
      { id: 2, email: 'b@example.com', status: 'active' },
    ])

    await assert.rejects(
      () =>
        db
          .query(accounts)
          .where({ status: 'active' })
          .orderBy('id', 'asc')
          .limit(1)
          .update({ status: 'paused' }),
      /D1DatabaseAdapter does not support data-table interactive transactions/,
    )
    await assert.rejects(
      () =>
        db.query(accounts).where({ status: 'active' }).orderBy('id', 'asc').limit(1).delete(),
      /D1DatabaseAdapter does not support data-table interactive transactions/,
    )
    await database.dispose()
  })
})
