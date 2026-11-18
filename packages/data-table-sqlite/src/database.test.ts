import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { Database, DataTableDatabaseError, rawSql, sql } from '@remix-run/data-table'

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
  it('handles object parameters without matching rows', async () => {
    let db = createSqliteDatabase({ filename: ':memory:' })

    try {
      await db.exec('create table users (email text)')
      await db.exec("insert into users values ('user@example.com'), ('other@example.com')")
      let input: unknown = JSON.parse('{"text":"email","values":[]}')

      // Node rejects object parameters; Bun treats them as named bindings.
      await db.exec(sql`select * from users where email = ${input}`).then(
        (result) => assert.deepEqual(result.rows, []),
        (error: unknown) => assert.ok(error instanceof DataTableDatabaseError),
      )
      await db.exec(sql`delete from users where email = ${input}`).then(
        (result) => assert.equal(result.affectedRows, 0),
        (error: unknown) => assert.ok(error instanceof DataTableDatabaseError),
      )

      let remaining = await db.exec('select count(*) as count from users')
      assert.deepEqual(remaining.rows, [{ count: 2 }])
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
