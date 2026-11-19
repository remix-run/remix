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

    await assert.rejects(db.exec(sql`select ${{ theme: 'dark' }}`), DataTableDatabaseError)
    await assert.rejects(db.exec('select ?', [['red', 'blue']]), DataTableDatabaseError)
    assert.equal(query.mock.callCount(), 0)
  })
})
