import * as assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { number, string } from '@remix-run/data-schema'
import { createDatabase, createTable } from '@remix-run/data-table'
import { Pool } from 'pg'

import { createPostgresDatabaseAdapter } from './adapter.ts'

let integrationEnabled =
  process.env.DATA_TABLE_INTEGRATION === '1' &&
  typeof process.env.DATA_TABLE_POSTGRES_URL === 'string'

let Accounts = createTable({
  name: 'accounts',
  columns: {
    id: number(),
    email: string(),
    status: string(),
  },
})

describe('postgres adapter integration', () => {
  let pool: Pool

  before(async function setup() {
    if (!integrationEnabled) return
    pool = new Pool({ connectionString: process.env.DATA_TABLE_POSTGRES_URL })
    await pool.query('drop table if exists accounts')
    await pool.query(
      'create table accounts (id integer primary key, email text not null, status text not null)',
    )
  })

  after(async function teardown() {
    if (!integrationEnabled) return
    await pool.query('drop table if exists accounts')
    await pool.end()
  })

  it('runs basic typed writes and reads', { skip: !integrationEnabled }, async function () {
    let db = createDatabase(createPostgresDatabaseAdapter(pool))

    await db
      .query(Accounts)
      .insert({ id: 1, email: 'a@example.com', status: 'active' }, { returning: ['id'] })
    await db
      .query(Accounts)
      .insert({ id: 2, email: 'b@example.com', status: 'inactive' }, { returning: ['id'] })

    let active = await db.query(Accounts).where({ status: 'active' }).all()
    let count = await db.query(Accounts).count()

    assert.equal(active.length, 1)
    assert.equal(active[0].email, 'a@example.com')
    assert.equal(count, 2)
  })
})
