import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { number, string } from '@remix-run/data-schema'
import Database from 'better-sqlite3'
import { createDatabase, createTable, eq } from '@remix-run/data-table'

import { createSqliteDatabaseAdapter } from './adapter.ts'

let accounts = createTable({
  name: 'accounts',
  columns: {
    id: number(),
    email: string(),
    status: string(),
  },
})

let projects = createTable({
  name: 'projects',
  columns: {
    id: number(),
    account_id: number(),
    name: string(),
  },
})

let accountProjects = createTable({
  name: 'account_projects',
  columns: {
    account_id: number(),
    project_id: number(),
    email: string(),
  },
  primaryKey: ['account_id', 'project_id'],
})

let sqliteAvailable = canOpenSqliteDatabase()

describe('sqlite adapter', { skip: !sqliteAvailable }, () => {
  it('short-circuits insertMany([]) and returns empty rows for returning queries', async () => {
    let prepareCalls = 0
    let sqlite = {
      prepare() {
        prepareCalls += 1
        return {
          reader: false,
          run() {
            return { changes: 0, lastInsertRowid: 0 }
          },
          all() {
            return []
          },
        }
      },
      exec() {},
      pragma() {},
    }

    let adapter = createSqliteDatabaseAdapter(sqlite as never)
    let result = await adapter.execute({
      statement: {
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
    assert.equal(prepareCalls, 0)
  })

  it('enables read uncommitted pragma for read-uncommitted transactions', async () => {
    let pragmas: string[] = []
    let execs: string[] = []

    let sqlite = {
      prepare() {
        throw new Error('not used')
      },
      pragma(statement: string) {
        pragmas.push(statement)
      },
      exec(statement: string) {
        execs.push(statement)
      },
    }

    let adapter = createSqliteDatabaseAdapter(sqlite as never)
    let token = await adapter.beginTransaction({ isolationLevel: 'read uncommitted' })
    await adapter.commitTransaction(token)

    assert.deepEqual(pragmas, ['read_uncommitted = true'])
    assert.deepEqual(execs, ['begin', 'commit'])
  })

  it('supports rollback and savepoint lifecycle with escaped names', async () => {
    let execs: string[] = []

    let sqlite = {
      prepare() {
        throw new Error('not used')
      },
      pragma() {},
      exec(statement: string) {
        execs.push(statement)
      },
    }

    let adapter = createSqliteDatabaseAdapter(sqlite as never)
    let token = await adapter.beginTransaction()

    await adapter.createSavepoint(token, 'sp"name')
    await adapter.rollbackToSavepoint(token, 'sp"name')
    await adapter.releaseSavepoint(token, 'sp"name')
    await adapter.rollbackTransaction(token)

    assert.deepEqual(execs, [
      'begin',
      'savepoint "sp""name"',
      'rollback to savepoint "sp""name"',
      'release savepoint "sp""name"',
      'rollback',
    ])
  })

  it('throws for unknown transaction tokens', async () => {
    let sqlite = {
      prepare() {
        throw new Error('not used')
      },
      pragma() {},
      exec() {},
    }

    let adapter = createSqliteDatabaseAdapter(sqlite as never)

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
  })

  it('normalizes non-object rows and count values in reader mode', async () => {
    let sqlite = {
      prepare() {
        return {
          reader: true,
          all() {
            return [1, null, { count: '2' }, { count: 'oops' }, { count: 5n }]
          },
          run() {
            throw new Error('not used')
          },
        }
      },
      exec() {},
      pragma() {},
    }

    let adapter = createSqliteDatabaseAdapter(sqlite as never)
    let result = await adapter.execute({
      statement: {
        kind: 'count',
        table: accounts,
        joins: [],
        where: [],
        groupBy: [],
        having: [],
      },
      transaction: undefined,
    })

    assert.deepEqual(result.rows, [{}, {}, { count: 2 }, { count: 'oops' }, { count: 5 }])
    assert.equal(result.affectedRows, undefined)
    assert.equal(result.insertId, undefined)
  })

  it('returns undefined metadata for run-mode select statements', async () => {
    let sqlite = {
      prepare() {
        return {
          reader: false,
          all() {
            return []
          },
          run() {
            return { changes: 3, lastInsertRowid: 7 }
          },
        }
      },
      exec() {},
      pragma() {},
    }

    let adapter = createSqliteDatabaseAdapter(sqlite as never)
    let result = await adapter.execute({
      statement: {
        kind: 'select',
        table: accounts,
        select: '*',
        joins: [],
        where: [],
        groupBy: [],
        having: [],
        orderBy: [],
        limit: undefined,
        offset: undefined,
        distinct: false,
      },
      transaction: undefined,
    })

    assert.equal(result.affectedRows, undefined)
    assert.equal(result.insertId, undefined)
  })

  it('does not expose insertId for composite primary keys in run mode', async () => {
    let sqlite = {
      prepare() {
        return {
          reader: false,
          all() {
            return []
          },
          run() {
            return { changes: 1, lastInsertRowid: 42 }
          },
        }
      },
      exec() {},
      pragma() {},
    }

    let adapter = createSqliteDatabaseAdapter(sqlite as never)
    let result = await adapter.execute({
      statement: {
        kind: 'insert',
        table: accountProjects,
        values: {
          account_id: 1,
          project_id: 2,
          email: 'team@example.com',
        },
      },
      transaction: undefined,
    })

    assert.equal(result.affectedRows, 1)
    assert.equal(result.insertId, undefined)
  })

  it('supports typed writes, reads, and nested transactions', async () => {
    let sqlite = new Database(':memory:')
    sqlite.exec(
      'create table accounts (id integer primary key, email text not null, status text not null)',
    )

    let db = createDatabase(createSqliteDatabaseAdapter(sqlite))

    await db.query(accounts).insert({ id: 1, email: 'a@example.com', status: 'active' })

    await db.transaction(async (outerTransaction) => {
      await outerTransaction
        .query(accounts)
        .insert({ id: 2, email: 'b@example.com', status: 'active' })

      await outerTransaction
        .transaction(async (innerTransactionDatabase) => {
          await innerTransactionDatabase
            .query(accounts)
            .insert({ id: 3, email: 'c@example.com', status: 'active' })

          throw new Error('rollback inner')
        })
        .catch(() => undefined)
    })

    let rows = await db.query(accounts).orderBy('id', 'asc').all()
    let count = await db.query(accounts).count()

    assert.equal(count, 2)
    assert.deepEqual(
      rows.map((row) => row.id),
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

    await db.query(accounts).insert({ id: 1, email: 'a@example.com', status: 'active' })

    let result = await db
      .query(accounts)
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

  it('accepts transaction options as best-effort hints', async () => {
    let sqlite = new Database(':memory:')
    sqlite.exec(
      'create table accounts (id integer primary key, email text not null, status text not null)',
    )

    let db = createDatabase(createSqliteDatabaseAdapter(sqlite))

    await db.transaction(
      async (transactionDatabase) => {
        await transactionDatabase
          .query(accounts)
          .insert({ id: 1, email: 'a@example.com', status: 'active' })
      },
      {
        isolationLevel: 'serializable',
        readOnly: true,
      },
    )

    let rows = await db.query(accounts).all()

    assert.equal(rows.length, 1)
    assert.equal(rows[0].id, 1)
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

    await db.query(accounts).insert({ id: 1, email: 'a@example.com', status: 'active' })
    await db.query(projects).insert({ id: 10, account_id: 1, name: 'Alpha' })
    await db.query(projects).insert({ id: 11, account_id: 99, name: 'Beta' })

    let count = await db
      .query(accounts)
      .join(projects, eq('accounts.id', 'projects.account_id'))
      .where(eq('accounts.email', 'a@example.com'))
      .count()

    assert.equal(count, 1)
    sqlite.close()
  })

  it('treats dotted select aliases as single identifiers', async () => {
    let sqlite = new Database(':memory:')
    sqlite.exec(
      'create table accounts (id integer primary key, email text not null, status text not null)',
    )

    let db = createDatabase(createSqliteDatabaseAdapter(sqlite))

    await db.query(accounts).insert({ id: 1, email: 'a@example.com', status: 'active' })

    let rows = await db.query(accounts).select({ 'account.email': accounts.email }).all()

    assert.equal(rows.length, 1)
    assert.equal(rows[0]['account.email'], 'a@example.com')
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
