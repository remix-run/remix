import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { column, table, eq, inList, sql, type Database } from '@remix-run/data-table'
import pg from 'pg'

import { PostgresDatabaseImplementation } from './adapter.ts'

function createPostgresTestDatabase(
  ...args: ConstructorParameters<typeof PostgresDatabaseImplementation>
): PostgresDatabaseImplementation {
  return new PostgresDatabaseImplementation(...args)
}

function createDatabase(adapter: PostgresDatabaseImplementation): Database {
  return adapter
}

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

describe('postgres adapter', () => {
  it('runs migration work on the pool connection that owns the lock', async () => {
    let statements: string[] = []
    let releaseArgs: unknown[][] = []
    let client = {
      async query(text: string) {
        statements.push(text)
        return {
          rows: text.includes('pg_advisory_unlock') ? [{ released: true }] : [],
          rowCount: 0,
        }
      },
      async connect() {
        throw new Error('reserved clients must not reconnect')
      },
      release(...args: unknown[]) {
        releaseArgs.push(args)
      },
    }
    let pool = {
      async query() {
        throw new Error('migration work must not use the pool')
      },
      async connect() {
        return client
      },
      async end() {},
    }
    let adapter = createPostgresTestDatabase(pool as never)

    let result = await adapter.withMigrationLock('app_migrations', async (lockedAdapter) => {
      assert.notEqual(lockedAdapter, adapter)
      await lockedAdapter.executeScript('create table users (id integer)')
      let transaction = await lockedAdapter.beginTransaction()
      await lockedAdapter.executeScript('insert into users values (1)', transaction)
      await lockedAdapter.commitTransaction(transaction)
      return 'done'
    })

    assert.equal(result, 'done')
    assert.deepEqual(statements, [
      'set lock_timeout to 60000',
      'select pg_advisory_lock(hashtext($1))',
      'set lock_timeout to default',
      'create table users (id integer)',
      'begin',
      'insert into users values (1)',
      'commit',
      'select pg_advisory_unlock(hashtext($1)) as "released"',
    ])
    assert.deepEqual(releaseArgs, [[]])
  })

  it('rejects a failed migration lock acquisition and destroys the pooled connection', async () => {
    let releaseArgs: unknown[][] = []
    let callbackCalls = 0
    let client = {
      async query(text: string) {
        if (text.includes('pg_advisory_lock')) {
          throw new Error('canceling statement due to lock timeout')
        }

        return { rows: [], rowCount: 0 }
      },
      release(...args: unknown[]) {
        releaseArgs.push(args)
      },
    }
    let pool = {
      async query() {
        throw new Error('not used')
      },
      async connect() {
        return client
      },
      async end() {},
    }
    let adapter = createPostgresTestDatabase(pool as never)

    await assert.rejects(
      () =>
        adapter.withMigrationLock('app_migrations', async () => {
          callbackCalls += 1
        }),
      /Postgres migration lock could not be acquired/,
    )
    assert.equal(callbackCalls, 0)
    assert.equal(releaseArgs.length, 1)
    assert.ok(releaseArgs[0][0] instanceof Error)
  })

  it('destroys the reserved connection when migration work fails', async () => {
    let releaseArgs: unknown[][] = []
    let client = {
      async query(text: string) {
        return {
          rows: text.includes('pg_advisory_unlock') ? [{ released: true }] : [],
          rowCount: 0,
        }
      },
      release(...args: unknown[]) {
        releaseArgs.push(args)
      },
    }
    let pool = {
      async query() {
        throw new Error('not used')
      },
      async connect() {
        return client
      },
      async end() {},
    }
    let adapter = createPostgresTestDatabase(pool as never)

    await assert.rejects(
      () =>
        adapter.withMigrationLock('app_migrations', async () => {
          throw new Error('migration failed')
        }),
      /migration failed/,
    )
    assert.equal(releaseArgs.length, 1)
    assert.ok(releaseArgs[0][0] instanceof Error)
  })

  it('runs migration work directly on client-backed connections', async () => {
    let statements: string[] = []
    let client = {
      async query(text: string) {
        statements.push(text)
        return {
          rows: text.includes('pg_advisory_unlock') ? [{ released: true }] : [],
          rowCount: 0,
        }
      },
    }
    let adapter = createPostgresTestDatabase(client as never)

    let result = await adapter.withMigrationLock('app_migrations', async (lockedAdapter) => {
      assert.equal(lockedAdapter, adapter)
      return 'done'
    })

    assert.equal(result, 'done')
    assert.deepEqual(statements, [
      'set lock_timeout to 60000',
      'select pg_advisory_lock(hashtext($1))',
      'set lock_timeout to default',
      'select pg_advisory_unlock(hashtext($1)) as "released"',
    ])
  })

  it('serializes migration locks on the same adapter', async () => {
    let lifecycle: string[] = []
    let signalFirstMigrationStarted: () => void = () => undefined
    let firstMigrationStarted = new Promise<void>((resolve) => {
      signalFirstMigrationStarted = resolve
    })
    let releaseFirstMigration: () => void = () => undefined
    let firstMigrationCanFinish = new Promise<void>((resolve) => {
      releaseFirstMigration = resolve
    })
    let client = {
      async query(text: string) {
        if (text.includes('pg_advisory_lock')) {
          lifecycle.push('lock')
        }

        if (text.includes('pg_advisory_unlock')) {
          lifecycle.push('unlock')
          return { rows: [{ released: true }], rowCount: 1 }
        }

        return { rows: [], rowCount: 0 }
      },
    }
    let adapter = createPostgresTestDatabase(client as never)

    let firstMigration = adapter.withMigrationLock('app_migrations', async () => {
      lifecycle.push('first:start')
      signalFirstMigrationStarted()
      await firstMigrationCanFinish
      lifecycle.push('first:end')
    })
    let secondMigration = adapter.withMigrationLock('app_migrations', async () => {
      lifecycle.push('second')
    })

    await firstMigrationStarted
    assert.deepEqual(lifecycle, ['lock', 'first:start'])

    releaseFirstMigration()
    await Promise.all([firstMigration, secondMigration])

    assert.deepEqual(lifecycle, [
      'lock',
      'first:start',
      'first:end',
      'unlock',
      'lock',
      'second',
      'unlock',
    ])
  })

  it('preserves migration errors when releasing the lock also fails', async () => {
    let migrationError = new Error('migration failed')
    let client = {
      async query(text: string) {
        if (text.includes('pg_advisory_unlock')) {
          throw new Error('lock cleanup failed')
        }

        return { rows: [], rowCount: 0 }
      },
    }
    let adapter = createPostgresTestDatabase(client as never)

    await assert.rejects(
      () =>
        adapter.withMigrationLock('app_migrations', async () => {
          throw migrationError
        }),
      (error: unknown) => error === migrationError,
    )
  })

  it('reports lock release failures after successful migration work', async () => {
    let client = {
      async query(text: string) {
        return {
          rows: text.includes('pg_advisory_unlock') ? [{ released: false }] : [],
          rowCount: 0,
        }
      },
    }
    let adapter = createPostgresTestDatabase(client as never)

    await assert.rejects(
      () => adapter.withMigrationLock('app_migrations', async () => 'done'),
      /migration lock was not held by the reserved connection/,
    )
  })

  it('throws instead of deadlocking when migration work re-enters the lock', async () => {
    let client = {
      async query(text: string) {
        return {
          rows: text.includes('pg_advisory_unlock') ? [{ released: true }] : [],
          rowCount: 0,
        }
      },
    }
    let adapter = createPostgresTestDatabase(client as never)

    await assert.rejects(
      () =>
        adapter.withMigrationLock('app_migrations', () =>
          adapter.withMigrationLock('app_migrations', async () => undefined),
        ),
      /migration lock is already held by this database/,
    )
  })

  it('preserves client-backed pools when wipe is unavailable', async () => {
    let endCalls = 0
    let pool = {
      async query() {
        return { rows: [], rowCount: 0 }
      },
      async connect() {
        throw new Error('not used')
      },
      async end() {
        endCalls += 1
      },
    }
    let adapter = createPostgresTestDatabase(pool as never)

    await assert.rejects(
      () => adapter.wipe(),
      /Postgres database wipe\(\) requires config-based construction/,
    )
    assert.equal(endCalls, 0)
  })

  it('wipes connection-string configured databases through a maintenance client', async (t) => {
    let statements: Array<{ text: string; values: unknown[] | undefined }> = []
    let maintenanceConfig: unknown
    let maintenanceClient = {
      async connect() {},
      async query(text: string, values?: unknown[]) {
        statements.push({ text, values })
        return { rows: [], rowCount: 0 }
      },
      async end() {},
    }

    t.mock.method(pg, 'Pool', function () {
      return {
        async query() {
          return { rows: [], rowCount: 0 }
        },
        async connect() {
          throw new Error('not used')
        },
        async end() {},
      }
    } as never)
    t.mock.method(pg, 'Client', function (config: unknown) {
      maintenanceConfig = config
      return maintenanceClient
    } as never)

    let adapter = createPostgresTestDatabase({
      connectionString: 'postgres://user:password@localhost/app',
    })

    await adapter.wipe()

    assert.ok(typeof maintenanceConfig === 'object' && maintenanceConfig !== null)
    assert.ok('database' in maintenanceConfig && maintenanceConfig.database === 'postgres')
    assert.ok(
      'connectionString' in maintenanceConfig &&
        typeof maintenanceConfig.connectionString === 'string',
    )
    assert.equal(new URL(maintenanceConfig.connectionString).pathname, '/postgres')
    assert.equal(statements.length, 3)
    assert.match(statements[0].text, /pg_terminate_backend/)
    assert.deepEqual(statements[0].values, ['app'])
    assert.equal(statements[1].text, 'drop database if exists "app"')
    assert.equal(statements[2].text, 'create database "app" template "template0"')
  })

  it('requires a resolvable database name for wipe()', async (t) => {
    let poolEndCalls = 0

    t.mock.method(pg, 'Pool', function () {
      return {
        async query() {
          return { rows: [], rowCount: 0 }
        },
        async connect() {
          throw new Error('not used')
        },
        async end() {
          poolEndCalls += 1
        },
      }
    } as never)

    let previousEnv = process.env.PGDATABASE
    delete process.env.PGDATABASE

    try {
      let adapter = createPostgresTestDatabase({ host: 'localhost', user: 'app' })

      await assert.rejects(
        () => adapter.wipe(),
        /Postgres database config requires a database name/,
      )
      assert.equal(poolEndCalls, 0)
    } finally {
      if (previousEnv === undefined) {
        delete process.env.PGDATABASE
      } else {
        process.env.PGDATABASE = previousEnv
      }
    }
  })

  it('falls back to PGDATABASE when config omits a database name', async (t) => {
    let statements: string[] = []
    let maintenanceClient = {
      async connect() {},
      async query(text: string) {
        statements.push(text)
        return { rows: [], rowCount: 0 }
      },
      async end() {},
    }

    t.mock.method(pg, 'Pool', function () {
      return {
        async query() {
          return { rows: [], rowCount: 0 }
        },
        async connect() {
          throw new Error('not used')
        },
        async end() {},
      }
    } as never)
    t.mock.method(pg, 'Client', function () {
      return maintenanceClient
    } as never)

    let previousEnv = process.env.PGDATABASE
    process.env.PGDATABASE = 'env_db'

    try {
      let adapter = createPostgresTestDatabase({ host: 'localhost', user: 'app' })

      await adapter.wipe()

      assert.equal(statements[1], 'drop database if exists "env_db"')
      assert.equal(statements[2], 'create database "env_db" template "template0"')
    } finally {
      if (previousEnv === undefined) {
        delete process.env.PGDATABASE
      } else {
        process.env.PGDATABASE = previousEnv
      }
    }
  })

  it('keeps the pool usable when the maintenance config cannot be resolved', async (t) => {
    let poolQueries: string[] = []
    let poolEndCalls = 0

    t.mock.method(pg, 'Pool', function () {
      return {
        async query(text: string) {
          poolQueries.push(text)
          return { rows: [], rowCount: 0 }
        },
        async connect() {
          throw new Error('not used')
        },
        async end() {
          poolEndCalls += 1
        },
      }
    } as never)

    let adapter = createPostgresTestDatabase({
      connectionString: 'not a valid url',
      database: 'app',
    })

    await assert.rejects(
      () => adapter.wipe(),
      /Postgres connection string must be a valid URL to resolve the maintenance database/,
    )
    assert.equal(poolEndCalls, 0)

    await adapter.executeScript('select 1')
    assert.deepEqual(poolQueries, ['select 1'])
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

    let adapter = new PostgresDatabaseImplementation(client as never)
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

    let adapter = new PostgresDatabaseImplementation(pool as never)
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

    let adapter = new PostgresDatabaseImplementation(client as never)
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

    let db = createDatabase(new PostgresDatabaseImplementation(client as never))

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

    let db = createDatabase(new PostgresDatabaseImplementation(client as never))

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

    let db = createDatabase(new PostgresDatabaseImplementation(client as never))

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

    let db = createDatabase(new PostgresDatabaseImplementation(client as never))

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

    let db = createDatabase(new PostgresDatabaseImplementation(pool as never))

    await db.transaction(async () => undefined)

    assert.deepEqual(lifecycle, ['connect', 'begin', 'commit', 'release'])
  })

  it('destroys a pooled client when transaction startup fails', async () => {
    let lifecycle: string[] = []
    let startupError = new Error('begin failed')
    let transactionClient = {
      async query() {
        throw startupError
      },
      release(error: unknown) {
        assert.equal(error, startupError)
        lifecycle.push('destroy')
      },
    }
    let pool = {
      async query() {},
      async connect() {
        lifecycle.push('connect')
        return transactionClient
      },
    }
    let adapter = new PostgresDatabaseImplementation(pool as never)

    await assert.rejects(() => adapter.beginTransaction(), /begin failed/)
    assert.deepEqual(lifecycle, ['connect', 'destroy'])
  })

  it('destroys a pooled client when commit fails', async () => {
    let commitError = new Error('commit failed')
    let lifecycle: string[] = []
    let transactionClient = {
      async query(text: string) {
        lifecycle.push(text)
        if (text === 'commit') throw commitError
        return { rows: [], rowCount: 0 }
      },
      release(error: unknown) {
        assert.equal(error, commitError)
        lifecycle.push('destroy')
      },
    }
    let pool = {
      async query() {},
      async connect() {
        lifecycle.push('connect')
        return transactionClient
      },
    }
    let database = new PostgresDatabaseImplementation(pool as never)
    let token = await database.beginTransaction()

    await assert.rejects(() => database.commitTransaction(token), /commit failed/)
    assert.deepEqual(lifecycle, ['connect', 'begin', 'commit', 'destroy'])
  })

  it('destroys a pooled client when rollback fails', async () => {
    let rollbackError = new Error('rollback failed')
    let lifecycle: string[] = []
    let transactionClient = {
      async query(text: string) {
        lifecycle.push(text)
        if (text === 'rollback') throw rollbackError
        return { rows: [], rowCount: 0 }
      },
      release(error: unknown) {
        assert.equal(error, rollbackError)
        lifecycle.push('destroy')
      },
    }
    let pool = {
      async query() {},
      async connect() {
        lifecycle.push('connect')
        return transactionClient
      },
    }
    let database = new PostgresDatabaseImplementation(pool as never)
    let token = await database.beginTransaction()

    await assert.rejects(() => database.rollbackTransaction(token), /rollback failed/)
    assert.deepEqual(lifecycle, ['connect', 'begin', 'rollback', 'destroy'])
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

    let db = createDatabase(new PostgresDatabaseImplementation(pool as never))

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

    let db = createDatabase(new PostgresDatabaseImplementation(pool as never))

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

    let db = createDatabase(new PostgresDatabaseImplementation(pool as never))

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

    let adapter = new PostgresDatabaseImplementation(client as never)
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

    let adapter = new PostgresDatabaseImplementation(client as never)

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

    let db = createDatabase(new PostgresDatabaseImplementation(client as never))

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

    let db = createDatabase(new PostgresDatabaseImplementation(client as never))

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

    let db = createDatabase(new PostgresDatabaseImplementation(client as never))

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

    let db = createDatabase(new PostgresDatabaseImplementation(client as never))

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

    let db = createDatabase(new PostgresDatabaseImplementation(client as never))
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

    let db = createDatabase(new PostgresDatabaseImplementation(client as never))
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

    let db = createDatabase(new PostgresDatabaseImplementation(client as never))
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

    let db = createDatabase(new PostgresDatabaseImplementation(client as never))
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

    let result = await new PostgresDatabaseImplementation(client as never).execute({
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

  it('executeScript forwards the script as an unparameterized query', async () => {
    let calls: Array<{ text: string; values: unknown[] | undefined }> = []
    let client = {
      async query(text: string, values?: unknown[]) {
        calls.push({ text, values })
        return { rows: [], rowCount: 0 }
      },
    }

    let adapter = new PostgresDatabaseImplementation(client as never)
    await adapter.executeScript('create table widgets (id int); insert into widgets values (1);')

    assert.equal(calls.length, 1)
    assert.equal(calls[0].text, 'create table widgets (id int); insert into widgets values (1);')
    assert.equal(calls[0].values, undefined)
  })
})
