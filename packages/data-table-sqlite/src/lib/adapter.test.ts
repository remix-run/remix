import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { column, createDatabase, table, eq } from '@remix-run/data-table'

import { createNativeSqliteDatabase } from '../../../data-table/test/native-sqlite.ts'

import { createSqliteDatabaseAdapter, type SqliteDatabase } from './adapter.ts'

const accounts = table({
  name: 'accounts',
  columns: {
    id: column.integer(),
    email: column.text(),
    status: column.text(),
  },
})

const projects = table({
  name: 'projects',
  columns: {
    id: column.integer(),
    account_id: column.integer(),
    name: column.text(),
  },
})

const accountProjects = table({
  name: 'account_projects',
  columns: {
    account_id: column.integer(),
    project_id: column.integer(),
    email: column.text(),
  },
  primaryKey: ['account_id', 'project_id'],
})

describe('sqlite adapter', () => {
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
    assert.equal(prepareCalls, 0)
  })

  it('checks table and column existence through adapter introspection hooks', async () => {
    let preparedStatements: string[] = []

    let sqlite = {
      prepare(statement: string) {
        preparedStatements.push(statement)

        if (statement.includes('sqlite_master')) {
          return {
            get() {
              return { exists: 1 }
            },
            all() {
              return []
            },
            run() {
              return { changes: 0, lastInsertRowid: 0 }
            },
          }
        }

        return {
          get() {
            return undefined
          },
          all() {
            return [{ name: 'id' }, { name: 'email' }]
          },
          run() {
            return { changes: 0, lastInsertRowid: 0 }
          },
        }
      },
      exec() {},
      pragma() {},
    }

    let adapter = createSqliteDatabaseAdapter(sqlite as never)
    let hasTable = await adapter.hasTable({ name: 'users' })
    let hasColumn = await adapter.hasColumn({ schema: 'app', name: 'users' }, 'email')

    assert.equal(hasTable, true)
    assert.equal(hasColumn, true)
    assert.equal(
      preparedStatements[0],
      'select 1 from sqlite_master where type = ? and name = ? limit 1',
    )
    assert.equal(preparedStatements[1], 'pragma "app".table_info("users")')
  })

  it('enables read uncommitted pragma for read-uncommitted transactions', async () => {
    let execs: string[] = []

    let sqlite = {
      prepare() {
        throw new Error('not used')
      },
      exec(statement: string) {
        execs.push(statement)
      },
    }

    let adapter = createSqliteDatabaseAdapter(sqlite as never)
    let token = await adapter.beginTransaction({ isolationLevel: 'read uncommitted' })
    await adapter.commitTransaction(token)

    assert.deepEqual(execs, ['pragma read_uncommitted = true', 'begin', 'commit'])
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
    await assert.rejects(
      () => adapter.hasTable({ name: 'users' }, { id: 'tx_missing' }),
      /Unknown transaction token: tx_missing/,
    )
    await assert.rejects(
      () => adapter.hasColumn({ name: 'users' }, 'email', { id: 'tx_missing' }),
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
      operation: {
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
      operation: {
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
      operation: {
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

  it('does not expose insertId for composite primary keys in reader mode', async () => {
    let sqlite = {
      prepare() {
        return {
          reader: true,
          all() {
            return [{ account_id: 1, project_id: 2 }]
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
      operation: {
        kind: 'insert',
        table: accountProjects,
        values: {
          account_id: 1,
          project_id: 2,
          email: 'team@example.com',
        },
        returning: ['account_id', 'project_id'],
      },
      transaction: undefined,
    })

    assert.equal(result.affectedRows, 1)
    assert.equal(result.insertId, undefined)
  })

  it('does not expose insertId for non-insert writes', async () => {
    let sqlite = {
      prepare() {
        return {
          reader: false,
          all() {
            return []
          },
          run() {
            return { changes: 1, lastInsertRowid: 99 }
          },
        }
      },
      exec() {},
      pragma() {},
    }

    let db = createDatabase(createSqliteDatabaseAdapter(sqlite as never))
    let result = await db.updateMany(accounts, { status: 'inactive' }, { where: { id: 1 } })

    assert.equal(result.affectedRows, 1)
    assert.equal(result.insertId, undefined)
  })

  it('normalizes bigint changes from native sqlite clients', async () => {
    let sqlite = {
      prepare() {
        return {
          reader: false,
          all() {
            return []
          },
          get() {
            return undefined
          },
          run() {
            return { changes: 2n, lastInsertRowid: 99n }
          },
        }
      },
      exec() {},
    } satisfies SqliteDatabase

    let db = createDatabase(createSqliteDatabaseAdapter(sqlite))
    let result = await db.updateMany(accounts, { status: 'inactive' }, { where: { id: 1 } })

    assert.equal(result.affectedRows, 2)
    assert.equal(result.insertId, undefined)
  })

  it('normalizes undefined statement values to null for native sqlite clients', async () => {
    let boundValues: unknown[][] = []
    let sqlite = {
      prepare() {
        return {
          reader: false,
          all(...values: unknown[]) {
            boundValues.push(values)
            return [{ id: 1, email: null, status: 'active' }]
          },
          get() {
            return undefined
          },
          run(...values: unknown[]) {
            boundValues.push(values)
            return { changes: 1, lastInsertRowid: 1 }
          },
        }
      },
      exec() {},
    } satisfies SqliteDatabase

    let adapter = createSqliteDatabaseAdapter(sqlite)

    await adapter.execute({
      operation: {
        kind: 'insert',
        table: accounts,
        values: {
          email: undefined,
          status: 'active',
        },
        returning: ['id', 'email', 'status'],
      },
      transaction: undefined,
    })
    await adapter.execute({
      operation: {
        kind: 'insert',
        table: accounts,
        values: {
          email: undefined,
          status: 'active',
        },
      },
      transaction: undefined,
    })

    assert.deepEqual(boundValues, [
      [null, 'active'],
      [null, 'active'],
    ])
  })

  it('supports typed writes, reads, and nested transactions', async () => {
    let sqlite = createNativeSqliteDatabase()
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
    let sqlite = createNativeSqliteDatabase()
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
    let sqlite = createNativeSqliteDatabase()
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
    let sqlite = createNativeSqliteDatabase()
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
    let sqlite = createNativeSqliteDatabase()
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

  it('executeScript runs multi-statement SQL natively', async () => {
    let sqlite = createNativeSqliteDatabase()
    let adapter = createSqliteDatabaseAdapter(sqlite)

    await adapter.executeScript(
      'create table widgets (id integer primary key); insert into widgets values (1); insert into widgets values (2);',
    )

    let rows = sqlite.prepare('select id from widgets order by id asc').all() as Array<{
      id: number
    }>
    assert.deepEqual(
      rows.map((row) => row.id),
      [1, 2],
    )
    sqlite.close()
  })
})
