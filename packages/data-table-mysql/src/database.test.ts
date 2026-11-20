import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { Database, DataTableDatabaseError, sql } from '@remix-run/data-table'
import { createPool } from 'mysql2/promise'

import { createMysqlDatabase, MysqlDatabase } from './index.ts'

describe('createMysqlDatabase', () => {
  it('creates and closes a typed MySQL database', async () => {
    let db: MysqlDatabase = createMysqlDatabase({ host: 'localhost' })

    assert.equal(db.dialect, 'mysql')
    assert.equal(db.capabilities.returning, false)
    assert.equal(db.capabilities.transactionalDdl, false)
    assert.equal(db instanceof Database, true)
    assert.equal(db instanceof MysqlDatabase, true)
    await db.close()
  })

  it('rejects object and array parameters before sending a query to MySQL', async (t) => {
    let pool = createPool({})
    t.after(() => pool.end())
    let query = t.mock.method(pool, 'query', async () => {
      throw new Error('Unexpected MySQL query')
    })
    let db = createMysqlDatabase(pool)

    let rejected = (error: unknown) =>
      error instanceof DataTableDatabaseError && error.cause instanceof TypeError

    await assert.rejects(db.exec(sql`select ${{ theme: 'dark' }}`), rejected)
    await assert.rejects(db.exec('select ?', [['red', 'blue']]), rejected)
    assert.equal(query.mock.callCount(), 0)
  })

  it('binds placeholders outside quoted text and comments as single values', async (t) => {
    let pool = createPool({ timezone: 'Z' })
    t.after(() => pool.end())
    let statements: unknown[] = []
    t.mock.method(pool, 'query', async (text: unknown) => {
      statements.push(text)
      return [[], []]
    })
    let db = createMysqlDatabase(pool)

    await db.exec(
      "select 'what?', 'it\\'s?', 'it''s?', \"say ?\", `col?`, ? -- note ?\n, ? /* ? */, ?, ? # ?",
      [1, "x'y", new Date('2026-06-01T12:00:00Z'), Buffer.from([0, 255])],
    )
    await db.exec('select 1--?, /*!50000 ? */ ?', [2, new Uint8Array([1]), new Uint16Array([1])])

    assert.deepEqual(statements, [
      "select 'what?', 'it\\'s?', 'it''s?', \"say ?\", `col?`, 1 -- note ?\n, 'x\\'y' /* ? */, '2026-06-01 12:00:00.000', X'00ff' # ?",
      "select 1--2, /*!50000 X'01' */ X'0100'",
    ])
  })

  it('binds bigints as integers and rejects non-finite numbers', async (t) => {
    let pool = createPool({})
    t.after(() => pool.end())
    let calls: unknown[][] = []
    t.mock.method(pool, 'query', async (...args: unknown[]) => {
      calls.push(args)
      return [[], []]
    })
    let db = createMysqlDatabase(pool)

    await db.exec('select ? from t where id = ?', [1.5, 9007199254740993n])
    await assert.rejects(
      db.exec('select ?', [Number.NaN]),
      (error: unknown) =>
        error instanceof DataTableDatabaseError &&
        error.cause instanceof TypeError &&
        error.cause.message === 'MySQL number parameters must be finite',
    )

    // The empty values array keeps mysql2's `namedPlaceholders` option from rescanning the SQL.
    assert.deepEqual(calls, [['select 1.5 from t where id = 9007199254740993', []]])
  })

  it('rejects statements whose placeholders and values do not match', async (t) => {
    let pool = createPool({})
    t.after(() => pool.end())
    let query = t.mock.method(pool, 'query', async () => {
      throw new Error('Unexpected MySQL query')
    })
    let db = createMysqlDatabase(pool)

    let mismatch = (message: RegExp) => (error: unknown) =>
      error instanceof DataTableDatabaseError &&
      error.cause instanceof TypeError &&
      message.test(error.cause.message)

    await assert.rejects(db.exec('select ?, ?', [1]), mismatch(/more placeholders than values/))
    await assert.rejects(db.exec("select '?'", [1]), mismatch(/more values than placeholders/))
    // mysql2's `??` identifier placeholder is two value placeholders here.
    await assert.rejects(db.exec('select ?? from t', ['c']), mismatch(/more placeholders/))
    assert.equal(query.mock.callCount(), 0)
  })
})
