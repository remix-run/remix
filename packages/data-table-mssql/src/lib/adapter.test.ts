import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { number, string } from '@remix-run/data-schema'
import { createDatabase, createTable, eq, ilike, inList, sql } from '@remix-run/data-table'

import { createMssqlDatabaseAdapter } from './adapter.ts'

let accounts = createTable({
  name: 'accounts',
  columns: {
    id: number(),
    email: string(),
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
    assert.match(statements[0].text, /lower\(\[email\]\) like lower\(@p1\)/)
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

    assert.deepEqual(lifecycle, ['begin', 'set transaction isolation level serializable', 'commit'])
  })

  it('ignores readOnly true and does not emit any SQL for it', async () => {
    let { pool, lifecycle } = createLifecyclePool()
    let db = createDatabase(createMssqlDatabaseAdapter(pool))

    await db.transaction(async () => undefined, { readOnly: true })

    // No SET TRANSACTION READ ONLY should appear — MSSQL does not support it.
    assert.deepEqual(lifecycle, ['begin', 'commit'])
  })

  it('applies isolationLevel and ignores readOnly when both are provided', async () => {
    let { pool, lifecycle } = createLifecyclePool()
    let db = createDatabase(createMssqlDatabaseAdapter(pool))

    await db.transaction(async () => undefined, {
      isolationLevel: 'serializable',
      readOnly: true,
    })

    // Only the isolation level SQL is emitted; readOnly is silently ignored.
    assert.deepEqual(lifecycle, ['begin', 'set transaction isolation level serializable', 'commit'])
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
    assert.match(statements[0].text, /\[accounts\]\.\[email\]\s*=\s*@p1/)
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

    assert.match(statements[0].text, /\[id\]\s+in\s+\(@p1,\s*@p2\)/)
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
    assert.match(statements[1].text, /where \(\(\[id\] = @p1\)\)/)
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

    assert.match(statements[0].text, /^merge \[accounts\] with \(holdlock\) as target using \(values \(@p1, @p2\)\)/)
    assert.match(statements[0].text, /on target\.\[id\] = source\.\[id\]/)
    assert.match(statements[0].text, /when matched then update set target\.\[id\] = @p3, target\.\[email\] = @p4/)
    assert.match(statements[0].text, /when not matched then insert \(\[id\], \[email\]\) values \(source\.\[id\], source\.\[email\]\)/)
    assert.deepEqual(statements[0].values, [7, 'upsert@example.com', 7, 'upsert@example.com'])
  })

  it('rewrites raw sql ? placeholders to named @p1, @p2, … parameters', async () => {
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

    assert.equal(statements[0].text, 'select * from accounts where id = @p1 and email = @p2')
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
      // releaseSavepoint is a no-op for MSSQL — no RELEASE SAVEPOINT SQL
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

  it('emits OFFSET…FETCH NEXT for limit + offset selects and omits TOP', async () => {
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
    // With returning enabled, a single INSERT…OUTPUT statement is issued (no fallback SELECT)
    assert.equal(calls, 1)
    assert.match(statements[0].text, /^insert into \[accounts\]/)
    assert.match(statements[0].text, / output inserted\.\*/)
  })
})
