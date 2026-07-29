import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createMysqlDatabase, type MysqlDatabase } from './index.ts'

describe('createMysqlDatabase', () => {
  it('creates and closes a typed MySQL database', async () => {
    let db: MysqlDatabase = createMysqlDatabase({ host: 'localhost' })

    assert.equal(db.dialect, 'mysql')
    assert.equal(db.capabilities.returning, false)
    assert.equal(db.capabilities.transactionalDdl, false)
    await db.close()
  })
})
