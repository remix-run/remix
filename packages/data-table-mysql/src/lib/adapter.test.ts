import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { DataMigrationOperation } from '@remix-run/data-table'
import { column, createDatabase, table, eq, ilike, inList } from '@remix-run/data-table'

import { createMysqlDatabaseAdapter } from './adapter.ts'

let accounts = table({
  name: 'accounts',
  columns: {
    id: column.integer(),
    email: column.text(),
  },
})

let projects = table({
  name: 'projects',
  columns: {
    id: column.integer(),
    account_id: column.integer(),
    name: column.text(),
  },
})

let invoices = table({
  name: 'billing.invoices',
  columns: {
    id: column.integer(),
    account_id: column.integer(),
  },
})

let accountProjects = table({
  name: 'account_projects',
  columns: {
    account_id: column.integer(),
    project_id: column.integer(),
    email: column.text(),
  },
  primaryKey: ['account_id', 'project_id'],
})

describe('mysql adapter', () => {
  it('applies explicit capability overrides', () => {
    let adapter = createMysqlDatabaseAdapter(
      {
        async query() {
          return [[], []]
        },
        async beginTransaction() {},
        async commit() {},
        async rollback() {},
      } as never,
      {
        capabilities: {
          returning: true,
          savepoints: false,
          upsert: false,
          transactionalDdl: true,
          migrationLock: false,
        },
      },
    )

    assert.deepEqual(adapter.capabilities, {
      returning: true,
      savepoints: false,
      upsert: false,
      transactionalDdl: true,
      migrationLock: false,
    })
  })

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

  it('executes migrate operations and migration lock hooks', async () => {
    let statements: Array<{ text: string; values: unknown[] }> = []

    let connection = {
      async query(text: string, values: unknown[] = []) {
        statements.push({ text, values })
        return [{ affectedRows: 0, insertId: undefined }, []]
      },
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
    }

    let adapter = createMysqlDatabaseAdapter(connection as never)

    let result = await adapter.migrate({
      operation: {
        kind: 'alterTable',
        table: { name: 'accounts' },
        changes: [{ kind: 'setTableComment', comment: "owner's table" }],
      },
    })

    await adapter.acquireMigrationLock()
    await adapter.releaseMigrationLock()

    assert.equal(result.affectedOperations, 1)
    assert.deepEqual(statements[0], {
      text: "alter table `accounts` comment = 'owner''s table'",
      values: [],
    })
    assert.deepEqual(statements[1], {
      text: 'select get_lock(?, 60)',
      values: ['data_table_migrations'],
    })
    assert.deepEqual(statements[2], {
      text: 'select release_lock(?)',
      values: ['data_table_migrations'],
    })
  })

  it('compiles migration statements for rich create and alter table operations', () => {
    let adapter = createMysqlDatabaseAdapter({
      async query() {
        return [[], []]
      },
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
    } as never)

    let createTableStatements = adapter.compileSql({
      kind: 'createTable',
      table: { name: 'users' },
      ifNotExists: true,
      columns: {
        id: { type: 'integer', nullable: false, autoIncrement: true, primaryKey: true },
        email: { type: 'varchar' },
        display_name: { type: 'text', default: { kind: 'literal', value: "o'hare" } },
        created_at: { type: 'timestamp', default: { kind: 'now' } },
        updated_at: {
          type: 'timestamp',
          default: { kind: 'sql', expression: '(current_timestamp)' },
        },
        reviewed_at: {
          type: 'timestamp',
          default: { kind: 'literal', value: new Date('2026-01-01T00:00:00.000Z') },
        },
        optional_note: { type: 'text', default: { kind: 'literal', value: null } },
        total: {
          type: 'decimal',
          precision: 10,
          scale: 2,
          default: { kind: 'literal', value: 3.5 },
        },
        fallback_total: { type: 'decimal' },
        is_active: { type: 'boolean', default: { kind: 'literal', value: false }, unique: true },
        public_id: { type: 'uuid' },
        due_on: { type: 'date' },
        starts_at: { type: 'time' },
        payload: { type: 'json' },
        blob_data: { type: 'binary' },
        big_total: { type: 'bigint', unsigned: true, default: { kind: 'literal', value: 9n } },
        status: { type: 'enum', enumValues: ['active', 'disabled'] },
        fallback_status: { type: 'enum', enumValues: [] },
        derived_score: { type: 'integer', computed: { expression: '(points + 1)', stored: false } },
        account_id: {
          type: 'integer',
          references: {
            table: { schema: 'app', name: 'accounts' },
            columns: ['id'],
            name: 'users_account_inline_fk',
            onDelete: 'set null',
            onUpdate: 'cascade',
          },
        },
        guarded_value: {
          type: 'integer',
          checks: [{ expression: 'guarded_value > 0', name: 'users_guarded_value_check' }],
        },
        unknown_type: {
          type: 'mystery' as any,
        },
      },
      primaryKey: { name: 'users_pk', columns: ['id'] },
      uniques: [
        { name: 'users_email_unique', columns: ['email'] },
        { name: 'users_status_unique', columns: ['status'] },
      ],
      checks: [
        { name: 'users_id_check', expression: 'id > 0' },
        { name: 'users_active_check', expression: 'is_active in (0, 1)' },
      ],
      foreignKeys: [
        {
          name: 'users_account_fk',
          columns: ['account_id'],
          references: { table: { name: 'accounts' }, columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'restrict',
        },
      ],
      comment: "users' table",
    })

    assert.equal(createTableStatements.length, 2)
    assert.match(createTableStatements[0].text, /^create table if not exists `users`/)
    assert.match(createTableStatements[0].text, /`email` varchar\(255\)/)
    assert.match(createTableStatements[0].text, /`display_name` text default 'o''hare'/)
    assert.match(
      createTableStatements[0].text,
      /`reviewed_at` timestamp default '2026-01-01T00:00:00\.000Z'/,
    )
    assert.match(createTableStatements[0].text, /`optional_note` text default null/)
    assert.match(createTableStatements[0].text, /`total` decimal\(10, 2\) default 3\.5/)
    assert.match(createTableStatements[0].text, /`fallback_total` decimal/)
    assert.match(createTableStatements[0].text, /`is_active` boolean default false unique/)
    assert.match(createTableStatements[0].text, /`public_id` char\(36\)/)
    assert.match(createTableStatements[0].text, /`due_on` date/)
    assert.match(createTableStatements[0].text, /`starts_at` time/)
    assert.match(createTableStatements[0].text, /`payload` json/)
    assert.match(createTableStatements[0].text, /`blob_data` blob/)
    assert.match(createTableStatements[0].text, /`big_total` bigint unsigned default 9/)
    assert.match(createTableStatements[0].text, /`status` enum\('active', 'disabled'\)/)
    assert.match(createTableStatements[0].text, /`fallback_status` text/)
    assert.match(
      createTableStatements[0].text,
      /`derived_score` int generated always as \(\(points \+ 1\)\) virtual/,
    )
    assert.match(
      createTableStatements[0].text,
      /`account_id` int references `app`\.`accounts` \(`id`\) on delete set null on update cascade/,
    )
    assert.match(createTableStatements[0].text, /`guarded_value` int check \(guarded_value > 0\)/)
    assert.match(createTableStatements[0].text, /`unknown_type` text/)
    assert.match(createTableStatements[0].text, /primary key \(`id`\)/)
    assert.match(createTableStatements[0].text, /unique \(`email`\)/)
    assert.match(
      createTableStatements[0].text,
      /constraint `users_status_unique` unique \(`status`\)/,
    )
    assert.match(createTableStatements[0].text, /check \(id > 0\)/)
    assert.match(
      createTableStatements[0].text,
      /constraint `users_active_check` check \(is_active in \(0, 1\)\)/,
    )
    assert.match(
      createTableStatements[0].text,
      /constraint `users_account_fk` foreign key \(`account_id`\) references `accounts` \(`id`\) on delete cascade on update restrict/,
    )
    assert.deepEqual(createTableStatements[1], {
      text: "alter table `users` comment = 'users'' table'",
      values: [],
    })

    let alterTableStatements = adapter.compileSql({
      kind: 'alterTable',
      table: { schema: 'app', name: 'users' },
      changes: [
        { kind: 'addColumn', column: 'nickname', definition: { type: 'text' } },
        {
          kind: 'changeColumn',
          column: 'nickname',
          definition: {
            type: 'text',
            default: { kind: 'sql', expression: '(concat(first_name, last_name))' },
            checks: [{ expression: 'char_length(nickname) > 1', name: 'users_nickname_len_check' }],
          },
        },
        { kind: 'renameColumn', from: 'nickname', to: 'handle' },
        { kind: 'dropColumn', column: 'legacy_handle' },
        { kind: 'addPrimaryKey', constraint: { name: 'users_pk', columns: ['id'] } },
        { kind: 'dropPrimaryKey', name: 'users_pk' },
        { kind: 'addUnique', constraint: { columns: ['email'], name: 'users_email_unique' } },
        { kind: 'dropUnique', name: 'users_email_unique' },
        {
          kind: 'addForeignKey',
          constraint: {
            columns: ['account_id'],
            references: { table: { name: 'accounts' }, columns: ['id'] },
            name: 'users_account_fk',
          },
        },
        { kind: 'dropForeignKey', name: 'users_account_fk' },
        {
          kind: 'addCheck',
          constraint: { expression: 'char_length(email) > 3', name: 'users_email_check' },
        },
        { kind: 'dropCheck', name: 'users_email_check' },
        { kind: 'setTableComment', comment: "owner's users" },
        { kind: 'somethingElse' as any },
      ] as any,
    })

    assert.equal(alterTableStatements.length, 13)
    assert.match(
      alterTableStatements[1].text,
      /alter table `app`\.`users` modify column `nickname` text default \(concat\(first_name, last_name\)\) check \(char_length\(nickname\) > 1\)/,
    )
    assert.match(alterTableStatements[2].text, /rename column `nickname` to `handle`/)
    assert.match(alterTableStatements[3].text, /drop column `legacy_handle`/)
    assert.match(alterTableStatements[4].text, /add primary key \(`id`\)/)
    assert.match(alterTableStatements[5].text, /drop primary key/)
    assert.match(
      alterTableStatements[6].text,
      /add constraint `users_email_unique` unique \(`email`\)/,
    )
    assert.match(alterTableStatements[7].text, /drop index `users_email_unique`/)
    assert.match(
      alterTableStatements[8].text,
      /add constraint `users_account_fk` foreign key \(`account_id`\) references `accounts` \(`id`\)/,
    )
    assert.match(alterTableStatements[9].text, /drop foreign key `users_account_fk`/)
    assert.match(
      alterTableStatements[10].text,
      /add constraint `users_email_check` check \(char_length\(email\) > 3\)/,
    )
    assert.match(alterTableStatements[11].text, /drop check `users_email_check`/)
    assert.equal(
      alterTableStatements[12].text,
      "alter table `app`.`users` comment = 'owner''s users'",
    )

    let createIndexWithName = adapter.compileSql({
      kind: 'createIndex',
      index: {
        table: { name: 'users' },
        name: 'email_idx',
        columns: ['email'],
      },
    })

    assert.equal(createIndexWithName.length, 1)
    assert.match(createIndexWithName[0].text, /create index `email_idx` on `users`/)
  })

  it('throws for unsupported data migration operation kinds', () => {
    let adapter = createMysqlDatabaseAdapter({
      async query() {
        return [[], []]
      },
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
    } as never)

    assert.throws(
      () => adapter.compileSql({ kind: 'unsupported_migration_operation' } as any),
      /Unsupported data migration operation kind/,
    )
  })

  it('compiles every DDL operation kind through compileSql()', () => {
    let adapter = createMysqlDatabaseAdapter({
      async query() {
        return [[], []]
      },
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
    } as never)

    let operations: DataMigrationOperation[] = [
      {
        kind: 'createTable',
        table: { schema: 'app', name: 'users' },
        ifNotExists: true,
        columns: {
          id: { type: 'integer', nullable: false, primaryKey: true },
        },
      },
      {
        kind: 'alterTable',
        table: { schema: 'app', name: 'users' },
        changes: [
          { kind: 'addColumn', column: 'email', definition: { type: 'text', nullable: false } },
        ],
      },
      {
        kind: 'renameTable',
        from: { schema: 'app', name: 'users' },
        to: { schema: 'app', name: 'accounts' },
      },
      { kind: 'dropTable', table: { schema: 'app', name: 'accounts' }, ifExists: true },
      {
        kind: 'createIndex',
        index: {
          table: { schema: 'app', name: 'users' },
          columns: ['email'],
          name: 'users_email_idx',
        },
      },
      { kind: 'dropIndex', table: { schema: 'app', name: 'users' }, name: 'users_email_idx' },
      {
        kind: 'renameIndex',
        table: { schema: 'app', name: 'users' },
        from: 'users_email_idx',
        to: 'users_email_idx_new',
      },
      {
        kind: 'addForeignKey',
        table: { schema: 'app', name: 'projects' },
        constraint: {
          columns: ['account_id'],
          references: {
            table: { schema: 'app', name: 'accounts' },
            columns: ['id'],
          },
          name: 'projects_account_id_fk',
          onDelete: 'cascade',
        },
      },
      {
        kind: 'dropForeignKey',
        table: { schema: 'app', name: 'projects' },
        name: 'projects_account_id_fk',
      },
      {
        kind: 'addCheck',
        table: { schema: 'app', name: 'users' },
        constraint: {
          name: 'users_email_check',
          expression: "email like '%@%'",
        },
      },
      { kind: 'dropCheck', table: { schema: 'app', name: 'users' }, name: 'users_email_check' },
      { kind: 'raw', sql: { text: 'select 1', values: [] } },
    ]

    for (let operation of operations) {
      let compiled = adapter.compileSql(operation)
      assert.ok(compiled.length > 0, operation.kind)
    }
  })
})
