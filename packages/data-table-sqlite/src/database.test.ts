import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { Database } from '@remix-run/data-table'

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
