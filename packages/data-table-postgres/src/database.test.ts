import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { Database } from '@remix-run/data-table'
import { createPostgresDatabase, PostgresDatabase } from './index.ts'

describe('createPostgresDatabase', () => {
  it('creates and closes a typed PostgreSQL database', async () => {
    let db: PostgresDatabase = createPostgresDatabase({
      connectionString: 'postgres://localhost/example',
    })

    assert.equal(db.dialect, 'postgres')
    assert.equal(db.capabilities.returning, true)
    assert.equal(db.capabilities.transactionalDdl, true)
    assert.equal(db instanceof Database, true)
    assert.equal(db instanceof PostgresDatabase, true)
    await db.close()
  })
})
