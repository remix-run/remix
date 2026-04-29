import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { column, createDatabase, table, eq, ilike, inList } from '@remix-run/data-table'

import { createMysqlDatabaseAdapter } from './adapter.ts'

const accounts = table({
  name: 'accounts',
  columns: {
    id: column.integer(),
    email: column.text(),
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

const invoices = table({
  name: 'billing.invoices',
  columns: {
    id: column.integer(),
    account_id: column.integer(),
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

describe('mysql adapter', () => {
  it('checks table and column existence through adapter introspection hooks', async () => {
    let statements: Array<{ text: string; values: unknown[] | undefined }> = []

    let connection = {
      async query(text: string, values?: unknown[]) {
        statements.push({ text, values })
        return [[{ exists: 1 }], []]
      },
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
    }

    let adapter = createMysqlDatabaseAdapter(connection as never)
    let hasTable = await adapter.hasTable({ schema: 'app', name: 'users' })
    let hasColumn = await adapter.hasColumn({ name: 'users' }, 'email')

    assert.equal(hasTable, true)
    assert.equal(hasColumn, true)
    assert.equal(
      statements[0]?.text,
      'select exists(select 1 from information_schema.tables where table_schema = ? and table_name = ?) as `exists`',
    )
    assert.deepEqual(statements[0]?.values, ['app', 'users'])
    assert.equal(
      statements[1]?.text,
      'select exists(select 1 from information_schema.columns where table_schema = database() and table_name = ? and column_name = ?) as `exists`',
    )
    assert.deepEqual(statements[1]?.values, ['users', 'email'])
  })

  it('routes introspection through transaction connections when a token is provided', async () => {
    let rootQueries = 0
    let connectionStatements: string[] = []

    let connection = {
      async query(text: string) {
        connectionStatements.push(text)
        return [[{ exists: 1 }], []]
      },
      async beginTransaction() {
        connectionStatements.push('begin')
      },
      async commit() {
        connectionStatements.push('commit')
      },
      async rollback() {
        connectionStatements.push('rollback')
      },
      release() {},
    }

    let pool = {
      async query() {
        rootQueries += 1
        return [[], []]
      },
      async getConnection() {
        return connection
      },
    }

    let adapter = createMysqlDatabaseAdapter(pool as never)
    let token = await adapter.beginTransaction()

    await adapter.hasTable({ name: 'users' }, token)
    await adapter.hasColumn({ name: 'users' }, 'email', token)
    await adapter.commitTransaction(token)

    assert.equal(rootQueries, 0)
    assert.deepEqual(connectionStatements, [
      'begin',
      'select exists(select 1 from information_schema.tables where table_schema = database() and table_name = ?) as `exists`',
      'select exists(select 1 from information_schema.columns where table_schema = database() and table_name = ? and column_name = ?) as `exists`',
      'commit',
    ])
  })

  it('short-circuits insertMany([]) and returns empty rows for returning queries', async () => {
    let calls = 0

    let connection = {
      async query() {
        calls += 1
        return [{ affectedRows: 0, insertId: undefined }, []]
      },
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
    }

    let adapter = createMysqlDatabaseAdapter(connection as never)

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
    assert.equal(calls, 0)
  })

  it('compiles ilike() with lower() and parses count results', async () => {
    let statements: Array<{ text: string; values: unknown[] }> = []

    let connection = {
      async query(text: string, values: unknown[] = []) {
        statements.push({ text, values })

        return [[{ count: '3' }], []]
      },
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
    }

    let db = createDatabase(createMysqlDatabaseAdapter(connection as never))

    let count = await db.query(accounts).where(ilike('email', '%EXAMPLE%')).count()

    assert.equal(count, 3)
    assert.match(statements[0].text, /lower\(`email`\) like lower\(\?\)/)
    assert.deepEqual(statements[0].values, ['%EXAMPLE%'])
  })

  it('starts and commits transactions on pooled connections', async () => {
    let lifecycle: string[] = []

    let poolConnection = {
      async query() {
        return [{ affectedRows: 1, insertId: 1 }, []]
      },
      async beginTransaction() {
        lifecycle.push('begin')
      },
      async commit() {
        lifecycle.push('commit')
      },
      async rollback() {
        lifecycle.push('rollback')
      },
      release() {
        lifecycle.push('release')
      },
    }

    let pool = {
      async query() {
        throw new Error('unexpected root query')
      },
      async getConnection() {
        lifecycle.push('getConnection')
        return poolConnection
      },
    }

    let db = createDatabase(createMysqlDatabaseAdapter(pool as never))

    await db.transaction(async (transactionDatabase) => {
      await transactionDatabase.query(accounts).insert({ id: 1, email: 'a@example.com' })
    })

    assert.deepEqual(lifecycle, ['getConnection', 'begin', 'commit', 'release'])
  })

  it('supports pooled transactions when getConnection() omits release()', async () => {
    let lifecycle: string[] = []

    let poolConnection = {
      async query() {
        return [{ affectedRows: 1, insertId: 1 }, []]
      },
      async beginTransaction() {
        lifecycle.push('begin')
      },
      async commit() {
        lifecycle.push('commit')
      },
      async rollback() {
        lifecycle.push('rollback')
      },
    }

    let pool = {
      async query() {
        throw new Error('unexpected root query')
      },
      async getConnection() {
        lifecycle.push('getConnection')
        return poolConnection
      },
    }

    let db = createDatabase(createMysqlDatabaseAdapter(pool as never))

    await db.transaction(async (transactionDatabase) => {
      await transactionDatabase.query(accounts).insert({ id: 1, email: 'a@example.com' })
    })

    assert.deepEqual(lifecycle, ['getConnection', 'begin', 'commit'])
  })

  it('applies transaction options when provided', async () => {
    let lifecycle: string[] = []

    let connection = {
      async query(text: string) {
        lifecycle.push(text)
        return [{ affectedRows: 0, insertId: undefined }, []]
      },
      async beginTransaction() {
        lifecycle.push('begin')
      },
      async commit() {
        lifecycle.push('commit')
      },
      async rollback() {
        lifecycle.push('rollback')
      },
    }

    let db = createDatabase(createMysqlDatabaseAdapter(connection as never))

    await db.transaction(async () => undefined, {
      isolationLevel: 'serializable',
      readOnly: true,
    })

    assert.deepEqual(lifecycle, [
      'set transaction isolation level serializable',
      'set transaction read only',
      'begin',
      'commit',
    ])
  })

  it('applies read write transaction mode when readOnly is false', async () => {
    let lifecycle: string[] = []

    let connection = {
      async query(text: string) {
        lifecycle.push(text)
        return [{ affectedRows: 0, insertId: undefined }, []]
      },
      async beginTransaction() {
        lifecycle.push('begin')
      },
      async commit() {
        lifecycle.push('commit')
      },
      async rollback() {
        lifecycle.push('rollback')
      },
    }

    let db = createDatabase(createMysqlDatabaseAdapter(connection as never))

    await db.transaction(async () => undefined, { readOnly: false })

    assert.deepEqual(lifecycle, ['set transaction read write', 'begin', 'commit'])
  })

  it('rolls back transactions and releases pooled connections', async () => {
    let lifecycle: string[] = []

    let poolConnection = {
      async query() {
        return [{ affectedRows: 0, insertId: undefined }, []]
      },
      async beginTransaction() {
        lifecycle.push('begin')
      },
      async commit() {
        lifecycle.push('commit')
      },
      async rollback() {
        lifecycle.push('rollback')
      },
      release() {
        lifecycle.push('release')
      },
    }

    let pool = {
      async query() {
        throw new Error('unexpected root query')
      },
      async getConnection() {
        lifecycle.push('getConnection')
        return poolConnection
      },
    }

    let db = createDatabase(createMysqlDatabaseAdapter(pool as never))

    await assert.rejects(
      () =>
        db.transaction(async () => {
          throw new Error('force rollback')
        }),
      /force rollback/,
    )

    assert.deepEqual(lifecycle, ['getConnection', 'begin', 'rollback', 'release'])
  })

  it('rolls back pooled transactions when getConnection() omits release()', async () => {
    let lifecycle: string[] = []

    let poolConnection = {
      async query() {
        return [{ affectedRows: 0, insertId: undefined }, []]
      },
      async beginTransaction() {
        lifecycle.push('begin')
      },
      async commit() {
        lifecycle.push('commit')
      },
      async rollback() {
        lifecycle.push('rollback')
      },
    }

    let pool = {
      async query() {
        throw new Error('unexpected root query')
      },
      async getConnection() {
        lifecycle.push('getConnection')
        return poolConnection
      },
    }

    let db = createDatabase(createMysqlDatabaseAdapter(pool as never))

    await assert.rejects(
      () =>
        db.transaction(async () => {
          throw new Error('force rollback')
        }),
      /force rollback/,
    )

    assert.deepEqual(lifecycle, ['getConnection', 'begin', 'rollback'])
  })

  it('supports savepoint lifecycle and escapes savepoint names', async () => {
    let statements: string[] = []

    let connection = {
      async query(text: string) {
        statements.push(text)
        return [{ affectedRows: 0, insertId: undefined }, []]
      },
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
    }

    let adapter = createMysqlDatabaseAdapter(connection as never)
    let token = await adapter.beginTransaction()

    await adapter.createSavepoint(token, 'sp`0')
    await adapter.rollbackToSavepoint(token, 'sp`0')
    await adapter.releaseSavepoint(token, 'sp`0')
    await adapter.commitTransaction(token)

    assert.deepEqual(statements, [
      'savepoint `sp``0`',
      'rollback to savepoint `sp``0`',
      'release savepoint `sp``0`',
    ])
  })

  it('throws for unknown transaction tokens', async () => {
    let connection = {
      async query() {
        return [{ affectedRows: 0, insertId: undefined }, []]
      },
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
    }

    let adapter = createMysqlDatabaseAdapter(connection as never)

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

  it('compiles column-to-column comparisons from string references', async () => {
    let statements: Array<{ text: string; values: unknown[] }> = []

    let connection = {
      async query(text: string, values: unknown[] = []) {
        statements.push({ text, values })
        return [[{ count: '0' }], []]
      },
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
    }

    let db = createDatabase(createMysqlDatabaseAdapter(connection as never))

    await db
      .query(accounts)
      .join(projects, eq('accounts.id', 'projects.account_id'))
      .where(eq('accounts.email', 'ops@example.com'))
      .count()

    assert.match(statements[0].text, /`accounts`\.`id`\s*=\s*`projects`\.`account_id`/)
    assert.match(statements[0].text, /`accounts`\.`email`\s*=\s*\?/)
    assert.deepEqual(statements[0].values, ['ops@example.com'])
  })

  it('compiles cross-schema table references in joins', async () => {
    let statements: Array<{ text: string; values: unknown[] }> = []

    let connection = {
      async query(text: string, values: unknown[] = []) {
        statements.push({ text, values })
        return [[{ count: '0' }], []]
      },
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
    }

    let db = createDatabase(createMysqlDatabaseAdapter(connection as never))

    await db.query(invoices).join(accounts, eq(accounts.id, invoices.account_id)).count()

    assert.match(statements[0].text, /from `billing`\.`invoices`/)
    assert.match(statements[0].text, /join `accounts`/)
    assert.match(statements[0].text, /`accounts`\.`id`\s*=\s*`billing`\.`invoices`\.`account_id`/)
  })

  it('treats dotted select aliases as single identifiers', async () => {
    let statements: Array<{ text: string; values: unknown[] }> = []

    let connection = {
      async query(text: string, values: unknown[] = []) {
        statements.push({ text, values })
        return [[], []]
      },
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
    }

    let db = createDatabase(createMysqlDatabaseAdapter(connection as never))

    await db.query(accounts).select({ 'account.email': accounts.email }).all()

    assert.match(statements[0].text, /as `account\.email`/)
  })

  it('does not create dangling bind parameters for inList predicates', async () => {
    let statements: Array<{ text: string; values: unknown[] }> = []

    let connection = {
      async query(text: string, values: unknown[] = []) {
        statements.push({ text, values })
        return [[{ count: '0' }], []]
      },
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
    }

    let db = createDatabase(createMysqlDatabaseAdapter(connection as never))

    await db
      .query(accounts)
      .where(inList('id', [1, 3]))
      .count()

    assert.match(statements[0].text, /`id`\s+in\s+\(\?,\s*\?\)/)
    assert.deepEqual(statements[0].values, [1, 3])
  })

  it('loads the inserted row for create({ returnRow: true }) without RETURNING support', async () => {
    let statements: Array<{ text: string; values: unknown[] }> = []
    let calls = 0

    let connection = {
      async query(text: string, values: unknown[] = []) {
        statements.push({ text, values })
        calls += 1

        if (calls === 1) {
          return [{ affectedRows: 1, insertId: 2 }, []]
        }

        if (calls === 2) {
          return [[{ id: 2, email: 'fallback@example.com' }], []]
        }

        throw new Error('unexpected query call')
      },
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
    }

    let db = createDatabase(createMysqlDatabaseAdapter(connection as never))

    let created = await db.create(
      accounts,
      {
        email: 'fallback@example.com',
      },
      { returnRow: true },
    )

    assert.equal(created.id, 2)
    assert.equal(created.email, 'fallback@example.com')
    assert.equal(statements.length, 2)
    assert.match(statements[0].text, /^insert into `accounts`/)
    assert.match(statements[1].text, /^select \* from `accounts`/)
    assert.match(statements[1].text, /where \(\(`id` = \?\)\)/)
    assert.deepEqual(statements[1].values, [2])
  })

  it('normalizes bigint count rows', async () => {
    let connection = {
      async query() {
        return [[{ count: 5n }], []]
      },
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
    }

    let db = createDatabase(createMysqlDatabaseAdapter(connection as never))
    let count = await db.query(accounts).count()

    assert.equal(count, 5)
  })

  it('defaults write metadata when mysql returns a non-object header', async () => {
    let connection = {
      async query() {
        return [0, []]
      },
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
    }

    let db = createDatabase(createMysqlDatabaseAdapter(connection as never))
    let result = await db.query(accounts).insert({ id: 1, email: 'a@example.com' })

    assert.equal(result.affectedRows, 0)
    assert.equal(result.insertId, undefined)
  })

  it('does not expose insertId for composite primary keys', async () => {
    let connection = {
      async query() {
        return [{ affectedRows: 1, insertId: 123 }, []]
      },
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
    }

    let db = createDatabase(createMysqlDatabaseAdapter(connection as never))
    let result = await db.query(accountProjects).insert({
      account_id: 1,
      project_id: 2,
      email: 'team@example.com',
    })

    assert.equal(result.affectedRows, 1)
    assert.equal(result.insertId, undefined)
  })

  it('preserves numeric count values without coercion', async () => {
    let connection = {
      async query() {
        return [[{ count: 7 }], []]
      },
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
    }

    let db = createDatabase(createMysqlDatabaseAdapter(connection as never))
    let count = await db.query(accounts).count()

    assert.equal(count, 7)
  })

  it('does not expose insertId for non-insert writes', async () => {
    let connection = {
      async query() {
        return [{ affectedRows: 1, insertId: 99 }, []]
      },
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
    }

    let db = createDatabase(createMysqlDatabaseAdapter(connection as never))
    let result = await db.updateMany(
      accounts,
      { email: 'updated@example.com' },
      { where: { id: 1 } },
    )

    assert.equal(result.affectedRows, 1)
    assert.equal(result.insertId, undefined)
  })

  it('executeScript forwards the script through query()', async () => {
    let calls: Array<{ text: string; values: unknown[] | undefined }> = []
    let connection = {
      async query(text: string, values?: unknown[]) {
        calls.push({ text, values })
        return [[], []]
      },
    }

    let adapter = createMysqlDatabaseAdapter(connection as never)
    await adapter.executeScript('create table widgets (id int); insert into widgets values (1);')

    assert.equal(calls.length, 1)
    assert.equal(calls[0].text, 'create table widgets (id int); insert into widgets values (1);')
    assert.equal(calls[0].values, undefined)
  })
})
