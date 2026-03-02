import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { DataMigrationOperation } from '@remix-run/data-table'
import { column, createDatabase, table, eq, ilike, inList, sql } from '@remix-run/data-table'

import { createMssqlDatabaseAdapter } from './adapter.ts'

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

describe('mssql adapter', () => {
  /**
   * Creates a mock pool whose transaction records lifecycle events (begin, commit,
   * rollback) and executed SQL text into the returned `lifecycle` array.
   */
  function createLifecyclePool() {
    let lifecycle: string[] = []

    let transaction = {
      async begin() {
        lifecycle.push('begin')
      },
      async commit() {
        lifecycle.push('commit')
      },
      async rollback() {
        lifecycle.push('rollback')
      },
      request() {
        return {
          input() {
            return this
          },
          async query(text: string) {
            lifecycle.push(text)
            return { recordset: [], rowsAffected: [0] }
          },
        }
      },
    }

    let pool = {
      request() {
        throw new Error('not used')
      },
      transaction() {
        return transaction
      },
    }

    return { pool: pool as never, lifecycle }
  }

  it('compiles ilike() with lower() and parses count results', async () => {
    let statements: Array<{ text: string; values: unknown[] }> = []

    let pool = {
      request() {
        let values: unknown[] = []

        return {
          input(_name: string, value: unknown) {
            values.push(value)
            return this
          },
          async query(text: string) {
            statements.push({ text, values: [...values] })
            return {
              recordset: [{ count: '3' }],
              rowsAffected: [1],
            }
          },
        }
      },
      transaction() {
        throw new Error('not used')
      },
    }

    let db = createDatabase(createMssqlDatabaseAdapter(pool as never))

    let count = await db.query(accounts).where(ilike('email', '%EXAMPLE%')).count()

    assert.equal(count, 3)
    assert.match(statements[0].text, /lower\(\[email\]\) like lower\(@dt_p1\)/)
    assert.deepEqual(statements[0].values, ['%EXAMPLE%'])
  })

  it('starts and commits transactions on pooled connections', async () => {
    let lifecycle: string[] = []

    let transaction = {
      async begin() {
        lifecycle.push('begin')
      },
      async commit() {
        lifecycle.push('commit')
      },
      async rollback() {
        lifecycle.push('rollback')
      },
      request() {
        return {
          input() {
            return this
          },
          async query() {
            lifecycle.push('query')
            return {
              recordset: [],
              rowsAffected: [1],
            }
          },
        }
      },
    }

    let pool = {
      request() {
        throw new Error('unexpected root query')
      },
      transaction() {
        lifecycle.push('transaction')
        return transaction
      },
    }

    let db = createDatabase(createMssqlDatabaseAdapter(pool as never))

    await db.transaction(async (transactionDatabase) => {
      await transactionDatabase.query(accounts).insert({ id: 1, email: 'a@example.com' })
    })

    assert.deepEqual(lifecycle, ['transaction', 'begin', 'query', 'commit'])
  })

  it('applies isolationLevel serializable', async () => {
    let { pool, lifecycle } = createLifecyclePool()
    let db = createDatabase(createMssqlDatabaseAdapter(pool))

    await db.transaction(async () => undefined, { isolationLevel: 'serializable' })

    assert.deepEqual(lifecycle, [
      'begin',
      'set transaction isolation level serializable',
      'set transaction isolation level read committed',
      'commit',
    ])
  })

  it('ignores readOnly true and does not emit any SQL for it', async () => {
    let { pool, lifecycle } = createLifecyclePool()
    let db = createDatabase(createMssqlDatabaseAdapter(pool))

    await db.transaction(async () => undefined, { readOnly: true })

    // No SET TRANSACTION READ ONLY should appear - MSSQL does not support it.
    assert.deepEqual(lifecycle, ['begin', 'commit'])
  })

  it('applies isolationLevel and ignores readOnly when both are provided', async () => {
    let { pool, lifecycle } = createLifecyclePool()
    let db = createDatabase(createMssqlDatabaseAdapter(pool))

    await db.transaction(async () => undefined, {
      isolationLevel: 'serializable',
      readOnly: true,
    })

    // Only the isolation level is applied; readOnly is silently ignored.
    // Isolation level is reset to read committed before commit.
    assert.deepEqual(lifecycle, [
      'begin',
      'set transaction isolation level serializable',
      'set transaction isolation level read committed',
      'commit',
    ])
  })

  it('compiles column-to-column comparisons from string references', async () => {
    let statements: Array<{ text: string; values: unknown[] }> = []

    let pool = {
      request() {
        let values: unknown[] = []

        return {
          input(_name: string, value: unknown) {
            values.push(value)
            return this
          },
          async query(text: string) {
            statements.push({ text, values: [...values] })

            return {
              recordset: [{ count: '0' }],
              rowsAffected: [1],
            }
          },
        }
      },
      transaction() {
        throw new Error('not used')
      },
    }

    let db = createDatabase(createMssqlDatabaseAdapter(pool as never))

    await db
      .query(accounts)
      .join(projects, eq('accounts.id', 'projects.account_id'))
      .where(eq('accounts.email', 'ops@example.com'))
      .count()

    assert.match(statements[0].text, /\[accounts\]\.\[id\]\s*=\s*\[projects\]\.\[account_id\]/)
    assert.match(statements[0].text, /\[accounts\]\.\[email\]\s*=\s*@dt_p1/)
    assert.deepEqual(statements[0].values, ['ops@example.com'])
  })

  it('does not create dangling bind parameters for inList predicates', async () => {
    let statements: Array<{ text: string; values: unknown[] }> = []

    let pool = {
      request() {
        let values: unknown[] = []

        return {
          input(_name: string, value: unknown) {
            values.push(value)
            return this
          },
          async query(text: string) {
            statements.push({ text, values: [...values] })

            return {
              recordset: [{ count: '0' }],
              rowsAffected: [1],
            }
          },
        }
      },
      transaction() {
        throw new Error('not used')
      },
    }

    let db = createDatabase(createMssqlDatabaseAdapter(pool as never))

    await db
      .query(accounts)
      .where(inList('id', [1, 3]))
      .count()

    assert.match(statements[0].text, /\[id\]\s+in\s+\(@dt_p1,\s*@dt_p2\)/)
    assert.deepEqual(statements[0].values, [1, 3])
  })

  it('loads the inserted row for create({ returnRow: true }) without RETURNING support', async () => {
    let statements: Array<{ text: string; values: unknown[] }> = []
    let calls = 0

    let pool = {
      request() {
        let values: unknown[] = []

        return {
          input(_name: string, value: unknown) {
            values.push(value)
            return this
          },
          async query(text: string) {
            calls += 1
            statements.push({ text, values: [...values] })

            if (calls === 1) {
              return {
                recordset: [],
                rowsAffected: [1],
              }
            }

            if (calls === 2) {
              return {
                recordset: [{ id: 2, email: 'fallback@example.com' }],
                rowsAffected: [1],
              }
            }

            throw new Error('unexpected query call')
          },
        }
      },
      transaction() {
        throw new Error('not used')
      },
    }

    let db = createDatabase(createMssqlDatabaseAdapter(pool as never))

    let created = await db.create(
      accounts,
      {
        id: 2,
        email: 'fallback@example.com',
      },
      { returnRow: true },
    )

    assert.equal(created.id, 2)
    assert.equal(created.email, 'fallback@example.com')
    assert.equal(statements.length, 2)
    assert.match(statements[0].text, /^insert into \[accounts\]/)
    assert.match(statements[1].text, /^select top \(1\) \* from \[accounts\]/)
    assert.match(statements[1].text, /where \(\(\[id\] = @dt_p1\)\)/)
    assert.deepEqual(statements[1].values, [2])
  })

  it('compiles upsert statements with merge using conflict targets', async () => {
    let statements: Array<{ text: string; values: unknown[] }> = []

    let pool = {
      request() {
        let values: unknown[] = []

        return {
          input(_name: string, value: unknown) {
            values.push(value)
            return this
          },
          async query(text: string) {
            statements.push({ text, values: [...values] })

            return {
              recordset: [],
              rowsAffected: [1],
            }
          },
        }
      },
      transaction() {
        throw new Error('not used')
      },
    }

    let db = createDatabase(createMssqlDatabaseAdapter(pool as never))

    await db.query(accounts).upsert(
      {
        id: 7,
        email: 'upsert@example.com',
      },
      {
        conflictTarget: ['id'],
      },
    )

    assert.match(
      statements[0].text,
      /^merge \[accounts\] with \(holdlock\) as target using \(values \(@dt_p1, @dt_p2\)\)/,
    )
    assert.match(statements[0].text, /on target\.\[id\] = source\.\[id\]/)
    assert.match(
      statements[0].text,
      /when matched then update set target\.\[id\] = @dt_p3, target\.\[email\] = @dt_p4/,
    )
    assert.match(
      statements[0].text,
      /when not matched then insert \(\[id\], \[email\]\) values \(source\.\[id\], source\.\[email\]\)/,
    )
    assert.deepEqual(statements[0].values, [7, 'upsert@example.com', 7, 'upsert@example.com'])
  })

  it('rewrites raw sql ? placeholders to named @dt_p1, @dt_p2, ... parameters', async () => {
    let statements: Array<{ text: string; values: unknown[] }> = []

    let pool = {
      request() {
        let values: unknown[] = []

        return {
          input(_name: string, value: unknown) {
            values.push(value)
            return this
          },
          async query(text: string) {
            statements.push({ text, values: [...values] })
            return {
              recordset: [],
              rowsAffected: [0],
            }
          },
        }
      },
      transaction() {
        throw new Error('not used')
      },
    }

    let db = createDatabase(createMssqlDatabaseAdapter(pool as never))

    await db.exec(sql`select * from accounts where id = ${42} and email = ${'a@example.com'}`)

    assert.equal(statements[0].text, 'select * from accounts where id = @dt_p1 and email = @dt_p2')
    assert.deepEqual(statements[0].values, [42, 'a@example.com'])
  })

  it('uses T-SQL savepoints for nested transactions and omits release', async () => {
    let lifecycle: string[] = []

    let transaction = {
      async begin() {
        lifecycle.push('begin')
      },
      async commit() {
        lifecycle.push('commit')
      },
      async rollback() {
        lifecycle.push('rollback')
      },
      request() {
        return {
          input() {
            return this
          },
          async query(text: string) {
            lifecycle.push(text)
            return {
              recordset: [],
              rowsAffected: [0],
            }
          },
        }
      },
    }

    let pool = {
      request() {
        throw new Error('not used')
      },
      transaction() {
        lifecycle.push('transaction')
        return transaction
      },
    }

    let db = createDatabase(createMssqlDatabaseAdapter(pool as never))

    await db.transaction(async (outerTx) => {
      await outerTx
        .transaction(async () => {
          throw new Error('abort nested')
        })
        .catch(() => undefined)
    })

    assert.deepEqual(lifecycle, [
      'transaction',
      'begin',
      'save transaction [sp_0]',
      'rollback transaction [sp_0]',
      // releaseSavepoint is a no-op for MSSQL - no RELEASE SAVEPOINT SQL
      'commit',
    ])
  })

  it('emits TOP (n) for limit-only selects without offset', async () => {
    let statements: Array<{ text: string }> = []

    let pool = {
      request() {
        return {
          input() {
            return this
          },
          async query(text: string) {
            statements.push({ text })
            return {
              recordset: [],
              rowsAffected: [0],
            }
          },
        }
      },
      transaction() {
        throw new Error('not used')
      },
    }

    let db = createDatabase(createMssqlDatabaseAdapter(pool as never))

    await db.query(accounts).limit(5).orderBy('id', 'asc').all()

    assert.match(statements[0].text, /^select top \(5\)/)
    assert.doesNotMatch(statements[0].text, /offset/)
  })

  it('emits OFFSET...FETCH NEXT for limit + offset selects and omits TOP', async () => {
    let statements: Array<{ text: string }> = []

    let pool = {
      request() {
        return {
          input() {
            return this
          },
          async query(text: string) {
            statements.push({ text })
            return {
              recordset: [],
              rowsAffected: [0],
            }
          },
        }
      },
      transaction() {
        throw new Error('not used')
      },
    }

    let db = createDatabase(createMssqlDatabaseAdapter(pool as never))

    await db.query(accounts).limit(5).offset(10).orderBy('id', 'asc').all()

    assert.doesNotMatch(statements[0].text, /top/)
    assert.match(statements[0].text, /offset 10 rows fetch next 5 rows only/)
  })

  it('injects ORDER BY (SELECT 1) when offset is used without an explicit orderBy', async () => {
    let statements: Array<{ text: string }> = []

    let pool = {
      request() {
        return {
          input() {
            return this
          },
          async query(text: string) {
            statements.push({ text })
            return {
              recordset: [],
              rowsAffected: [0],
            }
          },
        }
      },
      transaction() {
        throw new Error('not used')
      },
    }

    let db = createDatabase(createMssqlDatabaseAdapter(pool as never))

    await db.query(accounts).offset(10).all()

    assert.match(statements[0].text, /order by \(select 1\) offset 10 rows/)
    assert.doesNotMatch(statements[0].text, /fetch next/)
  })

  it('uses OUTPUT inserted.* for insert when capabilities.returning is enabled', async () => {
    let statements: Array<{ text: string; values: unknown[] }> = []
    let calls = 0

    let pool = {
      request() {
        let values: unknown[] = []

        return {
          input(_name: string, value: unknown) {
            values.push(value)
            return this
          },
          async query(text: string) {
            calls += 1
            statements.push({ text, values: [...values] })
            return {
              recordset: [{ id: 3, email: 'output@example.com' }],
              rowsAffected: [1],
            }
          },
        }
      },
      transaction() {
        throw new Error('not used')
      },
    }

    let db = createDatabase(
      createMssqlDatabaseAdapter(pool as never, { capabilities: { returning: true } }),
    )

    let created = await db.create(
      accounts,
      { id: 3, email: 'output@example.com' },
      { returnRow: true },
    )

    assert.equal(created.id, 3)
    assert.equal(created.email, 'output@example.com')
    // With returning enabled, a single INSERT...OUTPUT statement is issued (no fallback SELECT)
    assert.equal(calls, 1)
    assert.match(statements[0].text, /^insert into \[accounts\]/)
    assert.match(statements[0].text, / output inserted\.\*/)
  })

  it('does not expose insertId for composite primary keys', async () => {
    let pool = {
      request() {
        return {
          input() {
            return this
          },
          async query() {
            return {
              recordset: [{ account_id: 1, project_id: 2, email: 'team@example.com' }],
              rowsAffected: [1],
            }
          },
        }
      },
      transaction() {
        throw new Error('not used')
      },
    }

    let db = createDatabase(
      createMssqlDatabaseAdapter(pool as never, { capabilities: { returning: true } }),
    )
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

  it('compiles cross-schema table references in joins', async () => {
    let statements: Array<{ text: string; values: unknown[] }> = []

    let pool = {
      request() {
        let values: unknown[] = []

        return {
          input(_name: string, value: unknown) {
            values.push(value)
            return this
          },
          async query(text: string) {
            statements.push({ text, values: [...values] })
            return {
              recordset: [{ count: '0' }],
              rowsAffected: [1],
            }
          },
        }
      },
      transaction() {
        throw new Error('not used')
      },
    }

    let db = createDatabase(createMssqlDatabaseAdapter(pool as never))

    await db.query(invoices).join(accounts, eq(accounts.id, invoices.account_id)).count()

    assert.match(statements[0].text, /from \[billing\]\.\[invoices\]/)
    assert.match(statements[0].text, /join \[accounts\]/)
    assert.match(
      statements[0].text,
      /\[accounts\]\.\[id\]\s*=\s*\[billing\]\.\[invoices\]\.\[account_id\]/,
    )
  })

  it('does not reset isolation level on commit when none was set', async () => {
    let { pool, lifecycle } = createLifecyclePool()
    let db = createDatabase(createMssqlDatabaseAdapter(pool))

    await db.transaction(async () => undefined)

    // No SET TRANSACTION ISOLATION LEVEL should appear.
    assert.deepEqual(lifecycle, ['begin', 'commit'])
  })

  it('attempts best-effort isolation level reset on rollback', async () => {
    let { pool, lifecycle } = createLifecyclePool()
    let db = createDatabase(createMssqlDatabaseAdapter(pool))

    await assert.rejects(() =>
      db.transaction(
        async () => {
          throw new Error('forced rollback')
        },
        { isolationLevel: 'repeatable read' },
      ),
    )

    assert.deepEqual(lifecycle, [
      'begin',
      'set transaction isolation level repeatable read',
      'set transaction isolation level read committed',
      'rollback',
    ])
  })

  it('treats dotted select aliases as single identifiers', async () => {
    let statements: Array<{ text: string; values: unknown[] }> = []

    let pool = {
      request() {
        let values: unknown[] = []

        return {
          input(_name: string, value: unknown) {
            values.push(value)
            return this
          },
          async query(text: string) {
            statements.push({ text, values: [...values] })
            return {
              recordset: [],
              rowsAffected: [0],
            }
          },
        }
      },
      transaction() {
        throw new Error('not used')
      },
    }

    let db = createDatabase(createMssqlDatabaseAdapter(pool as never))

    await db.query(accounts).select({ 'account.email': accounts.email }).all()

    assert.match(statements[0].text, /as \[account\.email\]/)
  })

  it('applies explicit capability overrides', () => {
    let adapter = createMssqlDatabaseAdapter(
      {
        request() {
          throw new Error('not used')
        },
        transaction() {
          throw new Error('not used')
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

  it('short-circuits insertMany([]) and returns empty rows for returning queries', async () => {
    let pool = {
      request() {
        throw new Error('should not be called')
      },
      transaction() {
        throw new Error('not used')
      },
    }

    let db = createDatabase(
      createMssqlDatabaseAdapter(pool as never, { capabilities: { returning: true } }),
    )

    let result = await db.query(accounts).insertMany([], { returning: '*' })

    assert.deepEqual(result, {
      affectedRows: 0,
      insertId: undefined,
      rows: [],
    })
  })

  it('throws for unknown transaction tokens', async () => {
    let pool = {
      request() {
        return {
          input() {
            return this
          },
          async query() {
            return { recordset: [], rowsAffected: [0] }
          },
        }
      },
      transaction() {
        throw new Error('not used')
      },
    }

    let adapter = createMssqlDatabaseAdapter(pool as never)

    await assert.rejects(
      () => adapter.commitTransaction({ id: 'tx_unknown' }),
      /Unknown transaction token/,
    )

    await assert.rejects(
      () => adapter.rollbackTransaction({ id: 'tx_unknown' }),
      /Unknown transaction token/,
    )
  })

  it('checks table and column existence through adapter introspection hooks', async () => {
    let statements: Array<{ text: string; values: unknown[] }> = []

    let pool = {
      request() {
        let values: unknown[] = []

        return {
          input(_name: string, value: unknown) {
            values.push(value)
            return this
          },
          async query(text: string) {
            statements.push({ text, values: [...values] })

            if (text.includes('information_schema')) {
              return {
                recordset: [{ exists: 1 }],
                rowsAffected: [1],
              }
            }

            return {
              recordset: [{ exists: 1 }],
              rowsAffected: [1],
            }
          },
        }
      },
      transaction() {
        throw new Error('not used')
      },
    }

    let adapter = createMssqlDatabaseAdapter(pool as never)
    let hasTable = await adapter.hasTable({ schema: 'app', name: 'users' })
    let hasColumn = await adapter.hasColumn({ schema: 'app', name: 'users' }, 'email')

    assert.equal(hasTable, true)
    assert.equal(hasColumn, true)
    assert.match(statements[0].text, /object_id/)
    assert.match(statements[1].text, /information_schema\.columns/)
    assert.match(statements[1].text, /table_schema = @dt_p1/)
    assert.deepEqual(statements[1].values, ['app', 'users', 'email'])
  })

  it('checks table and column existence without a schema qualifier', async () => {
    let statements: Array<{ text: string; values: unknown[] }> = []

    let pool = {
      request() {
        let values: unknown[] = []

        return {
          input(_name: string, value: unknown) {
            values.push(value)
            return this
          },
          async query(text: string) {
            statements.push({ text, values: [...values] })

            return {
              recordset: [{ exists: 0 }],
              rowsAffected: [1],
            }
          },
        }
      },
      transaction() {
        throw new Error('not used')
      },
    }

    let adapter = createMssqlDatabaseAdapter(pool as never)
    let hasTable = await adapter.hasTable({ name: 'users' })
    let hasColumn = await adapter.hasColumn({ name: 'users' }, 'email')

    assert.equal(hasTable, false)
    assert.equal(hasColumn, false)
    assert.match(statements[0].text, /object_id/)
    assert.deepEqual(statements[0].values, ['[users]'])
    assert.match(statements[1].text, /information_schema\.columns/)
    assert.doesNotMatch(statements[1].text, /table_schema/)
    assert.deepEqual(statements[1].values, ['users', 'email'])
  })

  it('routes introspection through transaction clients when a token is provided', async () => {
    let poolQueries = 0
    let transactionStatements: string[] = []

    let transaction = {
      async begin() {},
      async commit() {},
      async rollback() {},
      request() {
        return {
          input() {
            return this
          },
          async query(text: string) {
            transactionStatements.push(text)
            return {
              recordset: [{ exists: 1 }],
              rowsAffected: [1],
            }
          },
        }
      },
    }

    let pool = {
      request() {
        poolQueries += 1
        return {
          input() {
            return this
          },
          async query() {
            return { recordset: [], rowsAffected: [0] }
          },
        }
      },
      transaction() {
        return transaction
      },
    }

    let adapter = createMssqlDatabaseAdapter(pool as never)
    let token = await adapter.beginTransaction()

    await adapter.hasTable({ name: 'users' }, token)
    await adapter.hasColumn({ name: 'users' }, 'email', token)
    await adapter.commitTransaction(token)

    assert.equal(poolQueries, 0)
    assert.equal(transactionStatements.length, 2)
    assert.match(transactionStatements[0], /object_id/)
    assert.match(transactionStatements[1], /information_schema\.columns/)
  })

  it('executes migrate operations with transaction tokens and migration locks', async () => {
    let lifecycle: string[] = []

    let transaction = {
      async begin() {
        lifecycle.push('begin')
      },
      async commit() {
        lifecycle.push('commit')
      },
      async rollback() {
        lifecycle.push('rollback')
      },
      request() {
        return {
          input() {
            return this
          },
          async query(text: string) {
            lifecycle.push(text)
            return { recordset: [], rowsAffected: [0] }
          },
        }
      },
    }

    let pool = {
      request() {
        return {
          input() {
            return this
          },
          async query(text: string) {
            lifecycle.push(text)
            return { recordset: [], rowsAffected: [0] }
          },
        }
      },
      transaction() {
        return transaction
      },
    }

    let adapter = createMssqlDatabaseAdapter(pool as never)
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
    assert.deepEqual(lifecycle, [
      'begin',
      'begin',
      "declare @dt_lock_result int; exec @dt_lock_result = sp_getapplock @Resource = 'data_table_migrations', @LockMode = 'Exclusive', @LockTimeout = 60000, @LockOwner = 'Transaction'; select @dt_lock_result as [returnValue]",
      'alter table [users] add [email] varchar(max) not null',
      'alter table [users] drop column if exists [legacy_email]',
      'commit',
      'commit',
    ])
  })

  it('routes migration operations through the migration lock transaction when no token is provided', async () => {
    let lifecycle: string[] = []

    let transaction = {
      async begin() {
        lifecycle.push('begin')
      },
      async commit() {
        lifecycle.push('commit')
      },
      async rollback() {
        lifecycle.push('rollback')
      },
      request() {
        return {
          input() {
            return this
          },
          async query(text: string) {
            lifecycle.push(text)
            return { recordset: [], rowsAffected: [0] }
          },
        }
      },
    }

    let pool = {
      request() {
        throw new Error('migration queries should use the lock transaction client')
      },
      transaction() {
        return transaction
      },
    }

    let adapter = createMssqlDatabaseAdapter(pool as never)

    await adapter.acquireMigrationLock()
    let result = await adapter.migrate({
      operation: {
        kind: 'alterTable',
        table: { name: 'users' },
        changes: [{ kind: 'dropColumn', column: 'legacy_email', ifExists: true }],
      },
    })
    await adapter.releaseMigrationLock()

    assert.equal(result.affectedOperations, 1)
    assert.deepEqual(lifecycle, [
      'begin',
      "declare @dt_lock_result int; exec @dt_lock_result = sp_getapplock @Resource = 'data_table_migrations', @LockMode = 'Exclusive', @LockTimeout = 60000, @LockOwner = 'Transaction'; select @dt_lock_result as [returnValue]",
      'alter table [users] drop column if exists [legacy_email]',
      'commit',
    ])
  })

  it('throws when migration lock acquisition fails', async () => {
    let lifecycle: string[] = []

    let transaction = {
      async begin() {
        lifecycle.push('begin')
      },
      async commit() {
        lifecycle.push('commit')
      },
      async rollback() {
        lifecycle.push('rollback')
      },
      request() {
        return {
          input() {
            return this
          },
          async query() {
            return { recordset: [{ returnValue: -1 }], rowsAffected: [0] }
          },
        }
      },
    }

    let pool = {
      request() {
        throw new Error('not used')
      },
      transaction() {
        return transaction
      },
    }

    let adapter = createMssqlDatabaseAdapter(pool as never)

    await assert.rejects(() => adapter.acquireMigrationLock(), {
      message: /Failed to acquire migration lock/,
    })

    assert.deepEqual(lifecycle, ['begin', 'rollback'])
  })

  it('treats migration lock hooks as no-ops when capabilities.migrationLock is false', async () => {
    let lifecycle: string[] = []

    let pool = {
      request() {
        return {
          input() {
            return this
          },
          async query(text: string) {
            lifecycle.push(text)
            return { recordset: [], rowsAffected: [0] }
          },
        }
      },
      transaction() {
        throw new Error('not used')
      },
    }

    let adapter = createMssqlDatabaseAdapter(pool as never, {
      capabilities: { migrationLock: false },
    })

    await adapter.acquireMigrationLock()
    await adapter.releaseMigrationLock()

    assert.deepEqual(lifecycle, [])
  })

  it('compiles rich table migrations including literals, references, and comments', () => {
    let pool = {
      request() {
        throw new Error('not used')
      },
      transaction() {
        throw new Error('not used')
      },
    }

    let adapter = createMssqlDatabaseAdapter(pool as never)

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
        starts_at: { type: 'time' },
        ends_at: { type: 'time', withTimezone: true },
        metadata: { type: 'json' },
        blob: { type: 'binary' },
        role: { type: 'enum', enumValues: ['admin', 'user'] },
        full_name: {
          type: 'text',
          computed: { expression: "first_name + ' ' + last_name", stored: true },
        },
        display_name: {
          type: 'text',
          computed: { expression: "first_name + ' ' + last_name", stored: false },
        },
        name: {
          type: 'text',
          checks: [{ expression: 'len(name) > 1', name: 'users_name_len_check' }],
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
        escaped: { type: 'text', default: { kind: 'literal', value: "O'Hare" } },
      },
      primaryKey: { name: 'users_pk', columns: ['id'] },
      uniques: [{ name: 'users_email_unique', columns: ['email'] }],
      checks: [{ name: 'users_name_check', expression: 'len(name) > 1' }],
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
    assert.match(
      compiled[0].text,
      /if object_id\(N'\[users\]', N'U'\) is null create table \[users\] \(/,
    )
    assert.match(compiled[0].text, /\[email\] varchar\(320\) not null unique/)
    assert.match(compiled[0].text, /\[visits\] int default 0/)
    assert.match(compiled[0].text, /\[bigint_visits\] bigint default 12/)
    assert.match(compiled[0].text, /\[is_admin\] bit default 0/)
    assert.match(compiled[0].text, /\[nickname\] varchar\(max\) default null/)
    assert.match(compiled[0].text, /\[safe_slug\] varchar\(max\) default md5\(email\)/)
    assert.match(compiled[0].text, /\[created_at\] datetimeoffset default getdate\(\)/)
    assert.match(compiled[0].text, /\[birthday\] date default '2024-01-02T00:00:00.000Z'/)
    assert.match(compiled[0].text, /\[score\] decimal\(10, 2\)/)
    assert.match(compiled[0].text, /\[ratio\] decimal/)
    assert.match(compiled[0].text, /\[starts_at\] time/)
    assert.match(compiled[0].text, /\[ends_at\] time/)
    assert.match(compiled[0].text, /\[metadata\] nvarchar\(max\)/)
    assert.match(compiled[0].text, /\[blob\] varbinary\(max\)/)
    assert.match(compiled[0].text, /\[role\] varchar\(255\)/)
    assert.match(compiled[0].text, /\[full_name\] as \(first_name \+ ' ' \+ last_name\) persisted/)
    assert.match(compiled[0].text, /\[display_name\] as \(first_name \+ ' ' \+ last_name\)/)
    assert.doesNotMatch(compiled[0].text, /\[display_name\].*persisted/)
    assert.match(compiled[0].text, /\[name\] varchar\(max\) check \(len\(name\) > 1\)/)
    assert.match(
      compiled[0].text,
      /\[manager_id\] int references \[app\]\.\[users\] \(\[id\]\) on delete set null on update cascade/,
    )
    assert.match(compiled[0].text, /\[escaped\] varchar\(max\) default 'O''Hare'/)
    assert.match(compiled[0].text, /constraint \[users_pk\] primary key \(\[id\]\)/)
    assert.match(compiled[0].text, /constraint \[users_email_unique\] unique \(\[email\]\)/)
    assert.match(compiled[0].text, /constraint \[users_name_check\] check \(len\(name\) > 1\)/)
    assert.match(
      compiled[0].text,
      /constraint \[users_account_fk\] foreign key \(\[id\]\) references \[app\]\.\[accounts\] \(\[id\]\) on delete cascade on update restrict/,
    )
    assert.match(compiled[1].text, /sp_updateextendedproperty/)
    assert.match(compiled[1].text, /sp_addextendedproperty/)
    assert.match(compiled[1].text, /fn_listextendedproperty/)
    assert.match(compiled[1].text, /owner''s table/)
  })

  it('compiles alterTable changes and standalone DDL operations', () => {
    let pool = {
      request() {
        throw new Error('not used')
      },
      transaction() {
        throw new Error('not used')
      },
    }

    let adapter = createMssqlDatabaseAdapter(pool as never)

    let alterStatements = adapter.compileSql({
      kind: 'alterTable',
      table: { schema: 'app', name: 'users' },
      changes: [
        { kind: 'addColumn', column: 'email', definition: { type: 'text', nullable: false } },
        { kind: 'changeColumn', column: 'email', definition: { type: 'varchar', length: 255 } },
        {
          kind: 'changeColumn',
          column: 'nickname',
          definition: { type: 'varchar', length: 100, nullable: true },
        },
        {
          kind: 'changeColumn',
          column: 'status',
          definition: { type: 'varchar', length: 32, nullable: false },
        },
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

    assert.equal(alterStatements.length, 15)
    assert.equal(
      alterStatements[0].text,
      'alter table [app].[users] add [email] varchar(max) not null',
    )
    assert.match(
      alterStatements[1].text,
      /alter table \[app\]\.\[users\] alter column \[email\] varchar\(255\)/,
    )
    assert.equal(
      alterStatements[2].text,
      'alter table [app].[users] alter column [nickname] varchar(100) null',
    )
    assert.equal(
      alterStatements[3].text,
      'alter table [app].[users] alter column [status] varchar(32) not null',
    )
    assert.match(alterStatements[4].text, /sp_rename/)
    assert.match(alterStatements[4].text, /\[app\]\.\[users\]\.email/)
    assert.match(alterStatements[4].text, /contact_email/)
    assert.equal(
      alterStatements[5].text,
      'alter table [app].[users] drop column if exists [legacy_email]',
    )
    assert.equal(
      alterStatements[6].text,
      'alter table [app].[users] add constraint [users_pk] primary key ([id])',
    )
    assert.equal(alterStatements[7].text, 'alter table [app].[users] drop constraint [users_pk]')
    assert.equal(
      alterStatements[8].text,
      'alter table [app].[users] add constraint [users_email_unique] unique ([contact_email])',
    )
    assert.equal(
      alterStatements[9].text,
      'alter table [app].[users] drop constraint [users_email_unique]',
    )
    assert.equal(
      alterStatements[10].text,
      'alter table [app].[users] add constraint [users_account_fk] foreign key ([account_id]) references [accounts] ([id])',
    )
    assert.equal(
      alterStatements[11].text,
      'alter table [app].[users] drop constraint [users_account_fk]',
    )
    assert.equal(
      alterStatements[12].text,
      `alter table [app].[users] add constraint [users_status_check] check (status <> 'deleted')`,
    )
    assert.equal(
      alterStatements[13].text,
      'alter table [app].[users] drop constraint [users_status_check]',
    )
    assert.match(alterStatements[14].text, /sp_updateextendedproperty/)
    assert.match(alterStatements[14].text, /sp_addextendedproperty/)
    assert.match(alterStatements[14].text, /fn_listextendedproperty/)
    assert.match(alterStatements[14].text, /Updated users table/)

    let createIndex = adapter.compileSql({
      kind: 'createIndex',
      ifNotExists: true,
      index: {
        table: { name: 'users' },
        name: 'email_idx',
        columns: ['email'],
        unique: true,
        where: 'email is not null',
      },
    })
    assert.match(
      createIndex[0].text,
      /if not exists \(select 1 from sys\.indexes where name = 'email_idx' and object_id = object_id\(N'\[users\]'\)\) create unique index \[email_idx\] on \[users\] \(\[email\]\) where email is not null/,
    )

    let dropIndex = adapter.compileSql({
      kind: 'dropIndex',
      table: { name: 'users' },
      name: 'email_idx',
      ifExists: true,
    })
    assert.equal(dropIndex[0].text, 'drop index if exists [email_idx] on [users]')

    let renameIndex = adapter.compileSql({
      kind: 'renameIndex',
      table: { name: 'users' },
      from: 'email_idx',
      to: 'users_email_idx',
    })
    assert.match(renameIndex[0].text, /sp_rename/)
    assert.match(renameIndex[0].text, /email_idx/)
    assert.match(renameIndex[0].text, /users_email_idx/)

    let renameTable = adapter.compileSql({
      kind: 'renameTable',
      from: { schema: 'app', name: 'users' },
      to: { schema: 'app', name: 'members' },
    })
    assert.match(renameTable[0].text, /sp_rename/)
    assert.match(renameTable[0].text, /\[app\]\.\[users\]/)
    assert.match(renameTable[0].text, /members/)

    let dropTable = adapter.compileSql({
      kind: 'dropTable',
      table: { name: 'users' },
      ifExists: true,
    })
    assert.match(dropTable[0].text, /if object_id/)
    assert.match(dropTable[0].text, /drop table \[users\]/)
  })

  it('throws for unsupported DDL kinds', () => {
    let pool = {
      request() {
        throw new Error('not used')
      },
      transaction() {
        throw new Error('not used')
      },
    }

    let adapter = createMssqlDatabaseAdapter(pool as never)

    assert.throws(
      () => adapter.compileSql({ kind: 'unknown' } as never),
      /Unsupported data migration operation kind/,
    )
  })

  it('compiles every DDL operation kind through compileSql()', () => {
    let pool = {
      request() {
        throw new Error('not used')
      },
      transaction() {
        throw new Error('not used')
      },
    }

    let adapter = createMssqlDatabaseAdapter(pool as never)

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
          expression: "charindex('@', email) > 1",
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

  it('normalizes bigint count rows', async () => {
    let pool = {
      request() {
        return {
          input() {
            return this
          },
          async query() {
            return {
              recordset: [{ count: 5n }],
              rowsAffected: [1],
            }
          },
        }
      },
      transaction() {
        throw new Error('not used')
      },
    }

    let db = createDatabase(createMssqlDatabaseAdapter(pool as never))
    let count = await db.query(accounts).count()

    assert.equal(count, 5)
  })

  it('normalizes non-object rows and falls back count to row length', async () => {
    let pool = {
      request() {
        return {
          input() {
            return this
          },
          async query() {
            return {
              recordset: [1, null, { count: 'oops' }],
              rowsAffected: [3],
            }
          },
        }
      },
      transaction() {
        throw new Error('not used')
      },
    }

    let db = createDatabase(createMssqlDatabaseAdapter(pool as never))
    let count = await db.query(accounts).count()

    assert.equal(count, 3)
  })

  it('returns undefined affectedRows for raw operations', async () => {
    let pool = {
      request() {
        return {
          input() {
            return this
          },
          async query() {
            return {
              recordset: [{ ok: true }],
              rowsAffected: [],
            }
          },
        }
      },
      transaction() {
        throw new Error('not used')
      },
    }

    let result = await createMssqlDatabaseAdapter(pool as never).execute({
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
})
