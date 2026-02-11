import * as assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { number, string } from '@remix-run/data-schema'
import { createDatabase, createTable } from '@remix-run/data-table'
import { createPool, type Pool } from 'mysql2/promise'

import { createMysqlDatabaseAdapter } from './adapter.ts'

let integrationEnabled =
  process.env.DATA_TABLE_INTEGRATION === '1' && typeof process.env.DATA_TABLE_MYSQL_URL === 'string'

let Accounts = createTable({
  name: 'accounts',
  columns: {
    id: number(),
    email: string(),
    status: string(),
  },
})

describe('mysql adapter integration', () => {
  let pool: Pool

  before(async function setup() {
    if (!integrationEnabled) return
    pool = createPool(process.env.DATA_TABLE_MYSQL_URL as string)
    await pool.query('drop table if exists accounts')
    await pool.query(
      'create table accounts (id int primary key, email varchar(255) not null, status varchar(32) not null)',
    )
  })

  after(async function teardown() {
    if (!integrationEnabled) return
    await pool.query('drop table if exists accounts')
    await pool.end()
  })

  it('runs basic typed writes and reads', { skip: !integrationEnabled }, async function () {
    let db = createDatabase(createMysqlDatabaseAdapter(pool))

    await db.query(Accounts).insert({ id: 1, email: 'a@example.com', status: 'active' })
    await db.query(Accounts).insert({ id: 2, email: 'b@example.com', status: 'inactive' })

    let active = await db.query(Accounts).where({ status: 'active' }).all()
    let count = await db.query(Accounts).count()

    assert.equal(active.length, 1)
    assert.equal(active[0].email, 'a@example.com')
    assert.equal(count, 2)
  })
})
