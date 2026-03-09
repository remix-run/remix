import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { DataMigrationOperation } from '@remix-run/data-table'
import { column, createDatabase, table, eq, inList, sql } from '@remix-run/data-table'

import { createPostgresDatabaseAdapter } from './adapter.ts'

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

describe('postgres adapter', () => {
  it('applies explicit capability overrides', () => {
    let adapter = createPostgresDatabaseAdapter(
      {
        async query() {
          return {
            rows: [],
            rowCount: 0,
            command: 'SELECT',
            oid: 0,
            fields: [],
          }
        },
      } as never,
      {
        capabilities: {
          returning: false,
          savepoints: false,
          upsert: false,
          transactionalDdl: false,
          migrationLock: false,
        },
      },
    )

    assert.deepEqual(adapter.capabilities, {
      returning: false,
      savepoints: false,
      upsert: false,
      transactionalDdl: false,
      migrationLock: false,
    })
  })

  it('checks table and column existence through adapter introspection hooks', async () => {
    let statements: Array<{ text: string; values: unknown[] | undefined }> = []

    let client = {
      async query(text: string, values?: unknown[]) {
        statements.push({ text, values })

        if (text.includes('pg_attribute')) {
          return {
            rows: [{ exists: 't' }],
            rowCount: 1,
          }
        }

        return {
          rows: [{ exists: true }],
          rowCount: 1,
        }
      },
    }

    let adapter = createPostgresDatabaseAdapter(client as never)
    let hasTable = await adapter.hasTable({ schema: 'app', name: 'users' })
    let hasColumn = await adapter.hasColumn({ schema: 'app', name: 'users' }, 'email')

    assert.equal(hasTable, true)
    assert.equal(hasColumn, true)
    assert.equal(statements[0]?.text, 'select to_regclass($1) is not null as "exists"')
    assert.equal(statements[0]?.values?.[0], '"app"."users"')
    assert.equal(
      statements[1]?.text,
      'select exists (select 1 from pg_attribute where attrelid = to_regclass($1) and attname = $2 and attnum > 0 and not attisdropped) as "exists"',
    )
    assert.equal(statements[1]?.values?.[0], '"app"."users"')
    assert.equal(statements[1]?.values?.[1], 'email')
  })

  it('routes introspection through transaction clients when a token is provided', async () => {
    let poolQueries = 0
    let transactionStatements: string[] = []

    let transactionClient = {
      async query(text: string) {
        transactionStatements.push(text)
        return {
          rows: [{ exists: true }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
      release() {},
    }

    let pool = {
      async query() {
        poolQueries += 1
        return {
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
      async connect() {
        return transactionClient
      },
    }

    let adapter = createPostgresDatabaseAdapter(pool as never)
    let token = await adapter.beginTransaction()

    await adapter.hasTable({ name: 'users' }, token)
    await adapter.hasColumn({ name: 'users' }, 'email', token)
    await adapter.commitTransaction(token)

    assert.equal(poolQueries, 0)
    assert.deepEqual(transactionStatements, [
      'begin',
      'select to_regclass($1) is not null as "exists"',
      'select exists (select 1 from pg_attribute where attrelid = to_regclass($1) and attname = $2 and attnum > 0 and not attisdropped) as "exists"',
      'commit',
    ])
  })

  it('short-circuits insertMany([]) and returns empty rows for returning queries', async () => {
    let calls = 0

    let client = {
      async query() {
        calls += 1
        return {
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
    }

    let adapter = createPostgresDatabaseAdapter(client as never)
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

  it('converts raw sql placeholders and normalizes count rows', async () => {
    let statements: Array<{ text: string; values: unknown[] | undefined }> = []

    let client = {
      async query(text: string, values?: unknown[]) {
        statements.push({ text, values })

        if (text.startsWith('select count(*)')) {
          return {
            rows: [{ count: '2' }],
            rowCount: 1,
            command: 'SELECT',
            oid: 0,
            fields: [],
          }
        }

        return {
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
    }

    let db = createDatabase(createPostgresDatabaseAdapter(client as never))

    let count = await db.query(accounts).count()
    await db.exec(sql`select * from accounts where id = ${42}`)

    assert.equal(count, 2)
    assert.equal(statements[1].text, 'select * from accounts where id = $1')
    assert.deepEqual(statements[1].values, [42])
  })

  it('uses savepoints for nested transactions', async () => {
    let statements: string[] = []

    let client = {
      async query(text: string) {
        statements.push(text)

        return {
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
    }

    let db = createDatabase(createPostgresDatabaseAdapter(client as never))

    await db.transaction(async (outerTransaction) => {
      await outerTransaction
        .transaction(async () => {
          throw new Error('Abort nested transaction')
        })
        .catch(() => undefined)
    })

    assert.deepEqual(statements, [
      'begin',
      'savepoint "sp_0"',
      'rollback to savepoint "sp_0"',
      'release savepoint "sp_0"',
      'commit',
    ])
  })

  it('applies transaction options when provided', async () => {
    let statements: string[] = []

    let client = {
      async query(text: string) {
        statements.push(text)

        return {
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
    }

    let db = createDatabase(createPostgresDatabaseAdapter(client as never))

    await db.transaction(async () => undefined, {
      isolationLevel: 'serializable',
      readOnly: true,
    })

    assert.deepEqual(statements, [
      'begin',
      'set transaction isolation level serializable read only',
      'commit',
    ])
  })

  it('applies read write transaction mode when readOnly is false', async () => {
    let statements: string[] = []

    let client = {
      async query(text: string) {
        statements.push(text)
        return {
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
    }

    let db = createDatabase(createPostgresDatabaseAdapter(client as never))

    await db.transaction(async () => undefined, { readOnly: false })

    assert.deepEqual(statements, ['begin', 'set transaction read write', 'commit'])
  })

  it('uses client.connect() for transactions and releases the connection', async () => {
    let lifecycle: string[] = []

    let transactionClient = {
      async query(text: string) {
        lifecycle.push(text)
        return {
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
      release() {
        lifecycle.push('release')
      },
    }

    let pool = {
      async query() {
        throw new Error('unexpected pool query')
      },
      async connect() {
        lifecycle.push('connect')
        return transactionClient
      },
    }

    let db = createDatabase(createPostgresDatabaseAdapter(pool as never))

    await db.transaction(async () => undefined)

    assert.deepEqual(lifecycle, ['connect', 'begin', 'commit', 'release'])
  })

  it('supports pooled transactions when connect() clients omit release()', async () => {
    let lifecycle: string[] = []

    let transactionClient = {
      async query(text: string) {
        lifecycle.push(text)
        return {
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
    }

    let pool = {
      async query() {
        throw new Error('unexpected pool query')
      },
      async connect() {
        lifecycle.push('connect')
        return transactionClient
      },
    }

    let db = createDatabase(createPostgresDatabaseAdapter(pool as never))

    await db.transaction(async () => undefined)

    assert.deepEqual(lifecycle, ['connect', 'begin', 'commit'])
  })

  it('rolls back transactions and releases connected clients', async () => {
    let lifecycle: string[] = []

    let transactionClient = {
      async query(text: string) {
        lifecycle.push(text)
        return {
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
      release() {
        lifecycle.push('release')
      },
    }

    let pool = {
      async query() {
        throw new Error('unexpected pool query')
      },
      async connect() {
        lifecycle.push('connect')
        return transactionClient
      },
    }

    let db = createDatabase(createPostgresDatabaseAdapter(pool as never))

    await assert.rejects(
      () =>
        db.transaction(async () => {
          throw new Error('force rollback')
        }),
      /force rollback/,
    )

    assert.deepEqual(lifecycle, ['connect', 'begin', 'rollback', 'release'])
  })

  it('rolls back pooled transactions when connect() clients omit release()', async () => {
    let lifecycle: string[] = []

    let transactionClient = {
      async query(text: string) {
        lifecycle.push(text)
        return {
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
    }

    let pool = {
      async query() {
        throw new Error('unexpected pool query')
      },
      async connect() {
        lifecycle.push('connect')
        return transactionClient
      },
    }

    let db = createDatabase(createPostgresDatabaseAdapter(pool as never))

    await assert.rejects(
      () =>
        db.transaction(async () => {
          throw new Error('force rollback')
        }),
      /force rollback/,
    )

    assert.deepEqual(lifecycle, ['connect', 'begin', 'rollback'])
  })

  it('supports savepoint lifecycle and escapes savepoint names', async () => {
    let statements: string[] = []

    let client = {
      async query(text: string) {
        statements.push(text)
        return {
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
    }

    let adapter = createPostgresDatabaseAdapter(client as never)
    let token = await adapter.beginTransaction()

    await adapter.createSavepoint(token, 'sp"name')
    await adapter.rollbackToSavepoint(token, 'sp"name')
    await adapter.releaseSavepoint(token, 'sp"name')
    await adapter.commitTransaction(token)

    assert.deepEqual(statements, [
      'begin',
      'savepoint "sp""name"',
      'rollback to savepoint "sp""name"',
      'release savepoint "sp""name"',
      'commit',
    ])
  })

  it('throws for unknown transaction tokens', async () => {
    let client = {
      async query() {
        return {
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
    }

    let adapter = createPostgresDatabaseAdapter(client as never)

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
    let statements: Array<{ text: string; values: unknown[] | undefined }> = []

    let client = {
      async query(text: string, values?: unknown[]) {
        statements.push({ text, values })

        return {
          rows: [{ count: '0' }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
    }

    let db = createDatabase(createPostgresDatabaseAdapter(client as never))

    await db
      .query(accounts)
      .join(projects, eq('accounts.id', 'projects.account_id'))
      .where(eq('accounts.email', 'ops@example.com'))
      .count()

    assert.match(statements[0].text, /"accounts"\."id"\s*=\s*"projects"\."account_id"/)
    assert.match(statements[0].text, /"accounts"\."email"\s*=\s*\$1/)
    assert.deepEqual(statements[0].values, ['ops@example.com'])
  })

  it('compiles cross-schema table references in joins', async () => {
    let statements: Array<{ text: string; values: unknown[] | undefined }> = []

    let client = {
      async query(text: string, values?: unknown[]) {
        statements.push({ text, values })

        return {
          rows: [{ count: '0' }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
    }

    let db = createDatabase(createPostgresDatabaseAdapter(client as never))

    await db.query(invoices).join(accounts, eq(accounts.id, invoices.account_id)).count()

    assert.match(statements[0].text, /from "billing"\."invoices"/)
    assert.match(statements[0].text, /join "accounts"/)
    assert.match(statements[0].text, /"accounts"\."id"\s*=\s*"billing"\."invoices"\."account_id"/)
  })

  it('treats dotted select aliases as single identifiers', async () => {
    let statements: Array<{ text: string; values: unknown[] | undefined }> = []

    let client = {
      async query(text: string, values?: unknown[]) {
        statements.push({ text, values })

        return {
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
    }

    let db = createDatabase(createPostgresDatabaseAdapter(client as never))

    await db.query(accounts).select({ 'account.email': accounts.email }).all()

    assert.match(statements[0].text, /as "account\.email"/)
  })

  it('does not create dangling bind parameters for inList predicates', async () => {
    let statements: Array<{ text: string; values: unknown[] | undefined }> = []

    let client = {
      async query(text: string, values?: unknown[]) {
        statements.push({ text, values })

        return {
          rows: [{ count: '0' }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
    }

    let db = createDatabase(createPostgresDatabaseAdapter(client as never))

    await db
      .query(accounts)
      .where(inList('id', [1, 3]))
      .count()

    assert.match(statements[0].text, /"id"\s+in\s+\(\$1,\s*\$2\)/)
    assert.deepEqual(statements[0].values, [1, 3])
  })

  it('normalizes bigint count rows', async () => {
    let client = {
      async query() {
        return {
          rows: [{ count: 5n }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
    }

    let db = createDatabase(createPostgresDatabaseAdapter(client as never))
    let count = await db.query(accounts).count()

    assert.equal(count, 5)
  })

  it('normalizes non-object rows and falls back count to row length', async () => {
    let client = {
      async query() {
        return {
          rows: [1, null, { count: 'oops' }],
          rowCount: 3,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
    }

    let db = createDatabase(createPostgresDatabaseAdapter(client as never))
    let count = await db.query(accounts).count()

    assert.equal(count, 3)
  })

  it('uses returned row count when rowCount is null for writes', async () => {
    let client = {
      async query() {
        return {
          rows: [{ id: 1, email: 'a@example.com' }],
          rowCount: null,
          command: 'INSERT',
          oid: 0,
          fields: [],
        }
      },
    }

    let db = createDatabase(createPostgresDatabaseAdapter(client as never))
    let result = await db
      .query(accounts)
      .insert({ id: 1, email: 'a@example.com' }, { returning: '*' })

    assert.equal(result.affectedRows, 1)
    assert.equal(result.insertId, 1)
  })

  it('does not expose insertId for composite primary keys', async () => {
    let client = {
      async query() {
        return {
          rows: [{ account_id: 1, project_id: 2, email: 'team@example.com' }],
          rowCount: 1,
          command: 'INSERT',
          oid: 0,
          fields: [],
        }
      },
    }

    let db = createDatabase(createPostgresDatabaseAdapter(client as never))
    let result = await db.query(accountProjects).insert(
      {
        account_id: 1,
        project_id: 2,
        email: 'team@example.com',
      },
      { returning: '*' },
    )

    assert.equal(result.affectedRows, 1)
    assert.equal(result.insertId, undefined)
  })

  it('returns undefined affectedRows for raw statements with null rowCount', async () => {
    let client = {
      async query() {
        return {
          rows: [{ ok: true }],
          rowCount: null,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
    }

    let result = await createPostgresDatabaseAdapter(client as never).execute({
      operation: {
        kind: 'raw',
        sql: {
          text: 'select 1',
          values: [],
        },
      },
      transaction: undefined,
    })

    assert.equal(result.affectedRows, undefined)
    assert.deepEqual(result.rows, [{ ok: true }])
  })

  it('executes migrate operations with transaction tokens and migration locks', async () => {
    let statements: Array<{ text: string; values: unknown[] | undefined }> = []

    let client = {
      async query(text: string, values?: unknown[]) {
        statements.push({ text, values })
        return {
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
    }

    let adapter = createPostgresDatabaseAdapter(client as never)
    let token = await adapter.beginTransaction()

    await adapter.acquireMigrationLock()
    let result = await adapter.migrate({
      operation: {
        kind: 'alterTable',
        table: { name: 'users' },
        changes: [
          { kind: 'addColumn', column: 'email', definition: { type: 'text', nullable: false } },
          { kind: 'dropColumn', column: 'legacy_email', ifExists: true },
        ],
      },
      transaction: token,
    })
    await adapter.releaseMigrationLock()
    await adapter.commitTransaction(token)

    assert.equal(result.affectedOperations, 2)
    assert.deepEqual(
      statements.map((statement) => statement.text),
      [
        'begin',
        'select pg_advisory_lock(hashtext($1))',
        'alter table "users" add column "email" text not null',
        'alter table "users" drop column if exists "legacy_email"',
        'select pg_advisory_unlock(hashtext($1))',
        'commit',
      ],
    )
    assert.deepEqual(statements[1].values, ['data_table_migrations'])
    assert.deepEqual(statements[4].values, ['data_table_migrations'])
  })

  it('compiles rich table migrations including literals, references, and comments', () => {
    let adapter = createPostgresDatabaseAdapter({
      async query() {
        return {
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
    } as never)

    let compiled = adapter.compileSql({
      kind: 'createTable',
      table: { name: 'users' },
      ifNotExists: true,
      columns: {
        id: { type: 'integer', nullable: false, primaryKey: true },
        email: { type: 'varchar', length: 320, nullable: false, unique: true },
        visits: { type: 'integer', default: { kind: 'literal', value: 0 } },
        bigint_visits: { type: 'bigint', default: { kind: 'literal', value: 12n } },
        is_admin: { type: 'boolean', default: { kind: 'literal', value: false } },
        nickname: { type: 'text', default: { kind: 'literal', value: null } },
        safe_slug: { type: 'text', default: { kind: 'sql', expression: 'md5(email)' } },
        created_at: { type: 'timestamp', withTimezone: true, default: { kind: 'now' } },
        birthday: {
          type: 'date',
          default: { kind: 'literal', value: new Date('2024-01-02T00:00:00.000Z') },
        },
        score: { type: 'decimal', precision: 10, scale: 2 },
        ratio: { type: 'decimal', precision: 8 },
        starts_at: { type: 'time', withTimezone: true },
        metadata: { type: 'json' },
        blob: { type: 'binary' },
        role: { type: 'enum', enumValues: ['admin', 'user'] },
        name: {
          type: 'text',
          checks: [{ expression: 'length(name) > 1', name: 'users_name_len_check' }],
        },
        manager_id: {
          type: 'integer',
          references: {
            table: { schema: 'app', name: 'users' },
            columns: ['id'],
            name: 'users_manager_fk',
            onDelete: 'set null',
            onUpdate: 'cascade',
          },
        },
        full_name: {
          type: 'text',
          computed: { expression: `first_name || ' ' || last_name`, stored: true },
        },
        escaped: { type: 'text', default: { kind: 'literal', value: "O'Hare" } },
      },
      primaryKey: { name: 'users_pk', columns: ['id'] },
      uniques: [{ name: 'users_email_unique', columns: ['email'] }],
      checks: [{ name: 'users_name_check', expression: 'length(name) > 1' }],
      foreignKeys: [
        {
          name: 'users_account_fk',
          columns: ['id'],
          references: { table: { schema: 'app', name: 'accounts' }, columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'restrict',
        },
      ],
      comment: "owner's table",
    })

    assert.equal(compiled.length, 2)
    assert.match(compiled[0].text, /create table if not exists "users" \(/)
    assert.match(compiled[0].text, /"email" varchar\(320\) not null unique/)
    assert.match(compiled[0].text, /"visits" integer default 0/)
    assert.match(compiled[0].text, /"bigint_visits" bigint default 12/)
    assert.match(compiled[0].text, /"is_admin" boolean default false/)
    assert.match(compiled[0].text, /"nickname" text default null/)
    assert.match(compiled[0].text, /"safe_slug" text default md5\(email\)/)
    assert.match(compiled[0].text, /"created_at" timestamp with time zone default now\(\)/)
    assert.match(compiled[0].text, /"birthday" date default '2024-01-02T00:00:00.000Z'/)
    assert.match(compiled[0].text, /"score" decimal\(10, 2\)/)
    assert.match(compiled[0].text, /"ratio" decimal/)
    assert.match(compiled[0].text, /"starts_at" time with time zone/)
    assert.match(compiled[0].text, /"metadata" jsonb/)
    assert.match(compiled[0].text, /"blob" bytea/)
    assert.match(compiled[0].text, /"role" text/)
    assert.match(compiled[0].text, /"name" text check \(length\(name\) > 1\)/)
    assert.match(
      compiled[0].text,
      /"manager_id" integer references "app"\."users" \("id"\) on delete set null on update cascade/,
    )
    assert.match(
      compiled[0].text,
      /"full_name" text generated always as \(first_name \|\| ' ' \|\| last_name\) stored/,
    )
    assert.match(compiled[0].text, /"escaped" text default 'O''Hare'/)
    assert.match(compiled[0].text, /primary key \("id"\)/)
    assert.match(compiled[0].text, /constraint "users_email_unique" unique \("email"\)/)
    assert.match(compiled[0].text, /constraint "users_name_check" check \(length\(name\) > 1\)/)
    assert.match(
      compiled[0].text,
      /constraint "users_account_fk" foreign key \("id"\) references "app"\."accounts" \("id"\) on delete cascade on update restrict/,
    )
    assert.equal(compiled[1].text, `comment on table "users" is 'owner''s table'`)
  })

  it('compiles alterTable changes and standalone DDL operations', () => {
    let adapter = createPostgresDatabaseAdapter({
      async query() {
        return {
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
    } as never)

    let alterStatements = adapter.compileSql({
      kind: 'alterTable',
      table: { schema: 'app', name: 'users' },
      changes: [
        { kind: 'addColumn', column: 'email', definition: { type: 'text', nullable: false } },
        { kind: 'changeColumn', column: 'email', definition: { type: 'varchar', length: 255 } },
        { kind: 'renameColumn', from: 'email', to: 'contact_email' },
        { kind: 'dropColumn', column: 'legacy_email', ifExists: true },
        { kind: 'addPrimaryKey', constraint: { name: 'users_pk', columns: ['id'] } },
        { kind: 'dropPrimaryKey', name: 'users_pk' },
        {
          kind: 'addUnique',
          constraint: { name: 'users_email_unique', columns: ['contact_email'] },
        },
        { kind: 'dropUnique', name: 'users_email_unique' },
        {
          kind: 'addForeignKey',
          constraint: {
            name: 'users_account_fk',
            columns: ['account_id'],
            references: { table: { name: 'accounts' }, columns: ['id'] },
          },
        },
        { kind: 'dropForeignKey', name: 'users_account_fk' },
        {
          kind: 'addCheck',
          constraint: { name: 'users_status_check', expression: "status <> 'deleted'" },
        },
        { kind: 'dropCheck', name: 'users_status_check' },
        { kind: 'setTableComment', comment: 'Updated users table' },
      ],
    })

    assert.equal(alterStatements.length, 13)
    assert.equal(
      alterStatements[0].text,
      'alter table "app"."users" add column "email" text not null',
    )
    assert.equal(
      alterStatements[1].text,
      'alter table "app"."users" alter column "email" type varchar(255)',
    )
    assert.equal(
      alterStatements[2].text,
      'alter table "app"."users" rename column "email" to "contact_email"',
    )
    assert.equal(
      alterStatements[3].text,
      'alter table "app"."users" drop column if exists "legacy_email"',
    )
    assert.equal(
      alterStatements[4].text,
      'alter table "app"."users" add constraint "users_pk" primary key ("id")',
    )
    assert.equal(alterStatements[5].text, 'alter table "app"."users" drop constraint "users_pk"')
    assert.equal(
      alterStatements[6].text,
      'alter table "app"."users" add constraint "users_email_unique" unique ("contact_email")',
    )
    assert.equal(
      alterStatements[7].text,
      'alter table "app"."users" drop constraint "users_email_unique"',
    )
    assert.equal(
      alterStatements[8].text,
      'alter table "app"."users" add constraint "users_account_fk" foreign key ("account_id") references "accounts" ("id")',
    )
    assert.equal(
      alterStatements[9].text,
      'alter table "app"."users" drop constraint "users_account_fk"',
    )
    assert.equal(
      alterStatements[10].text,
      `alter table "app"."users" add constraint "users_status_check" check (status <> 'deleted')`,
    )
    assert.equal(
      alterStatements[11].text,
      'alter table "app"."users" drop constraint "users_status_check"',
    )
    assert.equal(
      alterStatements[12].text,
      `comment on table "app"."users" is 'Updated users table'`,
    )

    let createIndex = adapter.compileSql({
      kind: 'createIndex',
      ifNotExists: true,
      index: {
        table: { name: 'users' },
        name: 'email_idx',
        columns: ['email'],
        unique: true,
        using: 'gin',
        where: 'email is not null',
      },
    })
    assert.equal(
      createIndex[0].text,
      'create unique index if not exists "email_idx" on "users" using gin ("email") where email is not null',
    )

    let dropIndex = adapter.compileSql({
      kind: 'dropIndex',
      table: { name: 'users' },
      name: 'email_idx',
      ifExists: true,
    })
    assert.equal(dropIndex[0].text, 'drop index if exists "email_idx"')

    let renameIndex = adapter.compileSql({
      kind: 'renameIndex',
      table: { name: 'users' },
      from: 'email_idx',
      to: 'users_email_idx',
    })
    assert.equal(renameIndex[0].text, 'alter index "email_idx" rename to "users_email_idx"')

    let renameTable = adapter.compileSql({
      kind: 'renameTable',
      from: { schema: 'app', name: 'users' },
      to: { schema: 'app', name: 'members' },
    })
    assert.equal(renameTable[0].text, 'alter table "app"."users" rename to "members"')

    let dropTable = adapter.compileSql({
      kind: 'dropTable',
      table: { name: 'users' },
      ifExists: true,
      cascade: true,
    })
    assert.equal(dropTable[0].text, 'drop table if exists "users" cascade')
  })

  it('throws for unsupported DDL kinds and non-stored computed columns', () => {
    let adapter = createPostgresDatabaseAdapter({
      async query() {
        return {
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
    } as never)

    assert.throws(
      () => adapter.compileSql({ kind: 'unknown' } as never),
      /Unsupported data migration operation kind/,
    )
    assert.throws(
      () =>
        adapter.compileSql({
          kind: 'createTable',
          table: { name: 'users' },
          columns: {
            full_name: {
              type: 'text',
              computed: {
                expression: `first_name || ' ' || last_name`,
                stored: false,
              },
            },
          },
        }),
      /only supports stored computed\/generated columns/,
    )
  })

  it('compiles every DDL operation kind through compileSql()', () => {
    let adapter = createPostgresDatabaseAdapter({
      async query() {
        return {
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
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
          expression: "position('@' in email) > 1",
        },
      },
      { kind: 'dropCheck', table: { schema: 'app', name: 'users' }, name: 'users_email_check' },
      { kind: 'raw', sql: sql`select 1` },
    ]

    for (let operation of operations) {
      let compiled = adapter.compileSql(operation)
      assert.ok(compiled.length > 0, operation.kind)
    }
  })
})
