import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { createPostgresDatabase, type PostgresDatabase } from './index.ts'

describe('createPostgresDatabase', () => {
  it('creates and closes a typed PostgreSQL database', async () => {
    let db: PostgresDatabase = createPostgresDatabase({
      connectionString: 'postgres://localhost/example',
    })

    assert.equal(db.dialect, 'postgres')
    assert.equal(db.capabilities.returning, true)
    assert.equal(db.capabilities.transactionalDdl, true)
    await db.close()
  })
})
