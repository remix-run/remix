import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { column, Database, DataTableDatabaseError, rawSql, sql, table } from '@remix-run/data-table'

import { createSqliteDatabase, SqliteDatabase } from './index.ts'

describe('createSqliteDatabase', () => {
  it('creates a typed SQLite database that owns its connection', async () => {
    let db: SqliteDatabase = createSqliteDatabase({ filename: ':memory:' })

    assert.equal(db.dialect, 'sqlite')
    assert.equal(db.capabilities.returning, true)
    assert.equal(db.capabilities.transactionalDdl, true)
    assert.equal(db instanceof Database, true)
    assert.equal(db instanceof SqliteDatabase, true)

    await db.close()
    await db.close()
  })
})

describe('SQL interpolation', () => {
  it('rejects object parameters instead of binding them as named parameters', async () => {
    let db = createSqliteDatabase({ filename: ':memory:' })

    try {
      await db.exec('create table users (email text)')
      await db.exec("insert into users values ('user@example.com'), ('other@example.com')")
      let input: unknown = JSON.parse('{"text":"email","values":[]}')

      await assert.rejects(
        db.exec(sql`select * from users where email = ${input}`),
        (error: unknown) =>
          error instanceof DataTableDatabaseError && error.cause instanceof TypeError,
      )
      await assert.rejects(
        db.exec(sql`delete from users where email = ${input}`),
        DataTableDatabaseError,
      )
      await assert.rejects(db.exec('select ?', [['red', 'blue']]), DataTableDatabaseError)

      let remaining = await db.exec('select count(*) as count from users')
      assert.deepEqual(remaining.rows, [{ count: 2 }])
    } finally {
      await db.close()
    }
  })

  it('binds dates, booleans, and bytes in any parameter position', async () => {
    let db = createSqliteDatabase({ filename: ':memory:' })
    let date = new Date('2026-06-01T12:00:00Z')

    try {
      let result = await db.exec(
        sql`select ${date} as first, ${true} as flag, ${new Date('2026-06-01T12:00:00.250Z')} as second, hex(${new Uint8Array([0, 255])}) as bytes, hex(${new Int16Array([1])}) as shorts`,
      )

      assert.deepEqual(result.rows, [
        {
          first: '2026-06-01 12:00:00',
          flag: 1,
          second: '2026-06-01 12:00:00.250',
          bytes: '00FF',
          shorts: '0100',
        },
      ])
    } finally {
      await db.close()
    }
  })

  it('compares bound dates with values stored by current_timestamp', async () => {
    let db = createSqliteDatabase({ filename: ':memory:' })

    try {
      await db.exec('create table events (at text)')
      await db.exec("insert into events values ('2026-06-01 12:00:00')")
      let result = await db.exec(
        sql`select
          (select count(*) from events where at > ${new Date('2026-06-01T06:00:00Z')}) as after,
          (select count(*) from events where at = ${new Date('2026-06-01T12:00:00Z')}) as same,
          (select count(*) from events where at < ${new Date('2026-06-01T12:00:00.500Z')}) as before`,
      )

      assert.deepEqual(result.rows, [{ after: 1, same: 1, before: 1 }])
    } finally {
      await db.close()
    }
  })

  it('rejects invalid dates', async () => {
    let db = createSqliteDatabase({ filename: ':memory:' })

    try {
      await assert.rejects(
        db.exec(sql`select ${new Date('invalid')}`),
        (error: unknown) =>
          error instanceof DataTableDatabaseError &&
          error.cause instanceof TypeError &&
          error.cause.message === 'SQLite Date parameters must be valid dates',
      )
    } finally {
      await db.close()
    }
  })

  it('writes timestamp and json columns through the query builder', async () => {
    let db = createSqliteDatabase({ filename: ':memory:' })
    let events = table({
      name: 'events',
      columns: { id: column.integer(), at: column.timestamp(), meta: column.json() },
    })
    let at = new Date('2026-06-01T12:00:00Z')

    try {
      await db.exec('create table events (id integer primary key, at text, meta text)')
      await db.create(events, { id: 1, at, meta: { theme: 'dark' } })
      await db.update(events, 1, { at })

      let result = await db.exec('select * from events')
      assert.deepEqual(result.rows, [
        { id: 1, at: '2026-06-01 12:00:00', meta: '{"theme":"dark"}' },
      ])
    } finally {
      await db.close()
    }
  })

  it('executes composed fragments and structural raw statements', async () => {
    let db = createSqliteDatabase({ filename: ':memory:' })

    try {
      await db.exec('create table users (email text)')
      await db.exec({
        text: 'insert into users values (?), (?)',
        values: ['user@example.com', 'admin@example.com'],
      })
      let condition = sql`email = ${'user@example.com'}`
      let result = await db.exec(
        sql`select email from users where ${condition} ${rawSql('limit ?', [1])}`,
      )

      assert.deepEqual(result.rows, [{ email: 'user@example.com' }])
    } finally {
      await db.close()
    }
  })
})
