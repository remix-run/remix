import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createSqliteDatabase, type SqliteDatabase } from './index.ts'

describe('createSqliteDatabase', () => {
  it('creates a typed SQLite database that owns its connection', () => {
    let db: SqliteDatabase = createSqliteDatabase({ filename: ':memory:' })

    assert.equal(db.dialect, 'sqlite')
    assert.equal(db.capabilities.returning, true)
    assert.equal(db.capabilities.transactionalDdl, true)

    db.close()
    db.close()
  })
})
