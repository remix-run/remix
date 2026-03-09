import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import Database from 'better-sqlite3'
import type { DataMigrationOperation } from '@remix-run/data-table'
import { column, createDatabase, table, eq } from '@remix-run/data-table'

import { createSqliteDatabaseAdapter } from './adapter.ts'

let accounts = table({
  name: 'accounts',
  columns: {
    id: column.integer(),
    email: column.text(),
    status: column.text(),
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

let accountProjects = table({
  name: 'account_projects',
  columns: {
    account_id: column.integer(),
    project_id: column.integer(),
    email: column.text(),
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

  it('executes migrate operations', async () => {
    let statements: Array<{ text: string; values: unknown[] }> = []

    let sqlite = {
      prepare(text: string) {
        return {
          reader: false,
          all() {
            return []
          },
          run(...values: unknown[]) {
            statements.push({ text, values })
            return { changes: 0, lastInsertRowid: 0 }
          },
        }
      },
      exec() {},
      pragma() {},
    }

    let adapter = createSqliteDatabaseAdapter(sqlite as never)
    let result = await adapter.migrate({
      operation: {
        kind: 'dropCheck',
        table: { name: 'accounts' },
        name: 'accounts_status_check',
      },
    })

    assert.equal(result.affectedOperations, 1)
    assert.deepEqual(statements[0], {
      text: 'alter table "accounts" drop constraint "accounts_status_check"',
      values: [],
    })
  })

  it('compiles migration statements for rich create and alter operations', () => {
    let sqlite = {
      prepare() {
        return {
          reader: false,
          all() {
            return []
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

    let createTableStatements = adapter.compileSql({
      kind: 'createTable',
      table: { name: 'users' },
      ifNotExists: true,
      columns: {
        id: { type: 'integer', nullable: false, primaryKey: true },
        email: { type: 'varchar', unique: true },
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
        total: { type: 'decimal', default: { kind: 'literal', value: 3.5 } },
        is_active: { type: 'boolean', default: { kind: 'literal', value: false } },
        public_id: { type: 'uuid' },
        due_on: { type: 'date' },
        starts_at: { type: 'time' },
        payload: { type: 'json' },
        blob_data: { type: 'binary' },
        big_total: { type: 'bigint', default: { kind: 'literal', value: 9n } },
        status: { type: 'enum', enumValues: ['active', 'disabled'] },
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
        { name: 'users_inline_email_unique', columns: ['email'] },
        { name: 'users_email_unique', columns: ['email'] },
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
    })

    assert.equal(createTableStatements.length, 1)
    assert.match(createTableStatements[0].text, /^create table if not exists "users"/)
    assert.match(createTableStatements[0].text, /"email" text unique/)
    assert.match(createTableStatements[0].text, /"display_name" text default 'o''hare'/)
    assert.match(
      createTableStatements[0].text,
      /"reviewed_at" text default '2026-01-01T00:00:00\.000Z'/,
    )
    assert.match(createTableStatements[0].text, /"optional_note" text default null/)
    assert.match(createTableStatements[0].text, /"total" numeric default 3\.5/)
    assert.match(createTableStatements[0].text, /"is_active" integer default 0/)
    assert.match(createTableStatements[0].text, /"public_id" text/)
    assert.match(createTableStatements[0].text, /"due_on" text/)
    assert.match(createTableStatements[0].text, /"starts_at" text/)
    assert.match(createTableStatements[0].text, /"payload" text/)
    assert.match(createTableStatements[0].text, /"blob_data" blob/)
    assert.match(createTableStatements[0].text, /"big_total" integer default 9/)
    assert.match(createTableStatements[0].text, /"status" text/)
    assert.match(
      createTableStatements[0].text,
      /"derived_score" integer generated always as \(\(points \+ 1\)\) virtual/,
    )
    assert.match(
      createTableStatements[0].text,
      /"account_id" integer references "app"\."accounts" \("id"\) on delete set null on update cascade/,
    )
    assert.match(
      createTableStatements[0].text,
      /"guarded_value" integer check \(guarded_value > 0\)/,
    )
    assert.match(createTableStatements[0].text, /"unknown_type" text/)
    assert.match(createTableStatements[0].text, /primary key \("id"\)/)
    assert.match(createTableStatements[0].text, /unique \("email"\)/)
    assert.match(
      createTableStatements[0].text,
      /constraint "users_email_unique" unique \("email"\)/,
    )
    assert.match(createTableStatements[0].text, /check \(id > 0\)/)
    assert.match(
      createTableStatements[0].text,
      /constraint "users_active_check" check \(is_active in \(0, 1\)\)/,
    )
    assert.match(
      createTableStatements[0].text,
      /constraint "users_account_fk" foreign key \("account_id"\) references "accounts" \("id"\) on delete cascade on update restrict/,
    )

    let alterTableStatements = adapter.compileSql({
      kind: 'alterTable',
      table: { schema: 'app', name: 'users' },
      changes: [
        { kind: 'addColumn', column: 'nickname', definition: { type: 'text' } },
        { kind: 'changeColumn', column: 'nickname', definition: { type: 'text' } },
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
          constraint: { expression: 'length(email) > 3', name: 'users_email_check' },
        },
        { kind: 'dropCheck', name: 'users_email_check' },
        { kind: 'setTableComment', comment: "owner's users" },
        { kind: 'somethingElse' as any },
      ] as any,
    })

    assert.equal(alterTableStatements.length, 12)
    assert.match(alterTableStatements[1].text, /alter column "nickname" type text/)
    assert.match(alterTableStatements[2].text, /rename column "nickname" to "handle"/)
    assert.match(alterTableStatements[3].text, /drop column "legacy_handle"/)
    assert.match(alterTableStatements[4].text, /add primary key \("id"\)/)
    assert.match(alterTableStatements[5].text, /drop primary key/)
    assert.match(
      alterTableStatements[6].text,
      /add constraint "users_email_unique" unique \("email"\)/,
    )
    assert.match(alterTableStatements[7].text, /drop constraint "users_email_unique"/)
    assert.match(
      alterTableStatements[8].text,
      /add constraint "users_account_fk" foreign key \("account_id"\) references "accounts" \("id"\)/,
    )
    assert.match(alterTableStatements[9].text, /drop constraint "users_account_fk"/)
    assert.match(
      alterTableStatements[10].text,
      /add constraint "users_email_check" check \(length\(email\) > 3\)/,
    )
    assert.match(alterTableStatements[11].text, /drop constraint "users_email_check"/)

    let createIndexWithName = adapter.compileSql({
      kind: 'createIndex',
      index: {
        table: { name: 'users' },
        name: 'email_idx',
        columns: ['email'],
      },
    })

    assert.equal(createIndexWithName.length, 1)
    assert.match(createIndexWithName[0].text, /create index "email_idx" on "users"/)
  })

  it('throws for unsupported data migration operation kinds', () => {
    let sqlite = {
      prepare() {
        return {
          reader: false,
          all() {
            return []
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

    assert.throws(
      () => adapter.compileSql({ kind: 'unsupported_migration_operation' } as any),
      /Unsupported data migration operation kind/,
    )
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

  it('compiles every DDL operation kind through compileSql()', () => {
    let sqlite = {
      prepare() {
        return {
          reader: true,
          all() {
            return []
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
