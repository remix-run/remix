import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import * as assert from '@remix-run/assert'
import { column, table } from '@remix-run/data-table'
import { describe, it } from '@remix-run/test'

import { createSqliteDatabase } from './database.ts'

const accounts = table({
  name: 'accounts',
  columns: {
    id: column.integer(),
    email: column.text(),
  },
})

describe('sqlite database resource', () => {
  it('opens a new file-backed sqlite client for each connection', async () => {
    let databaseDirectory = await mkdtemp(join(tmpdir(), 'remix-data-table-sqlite-'))
    let database = createSqliteDatabase({ path: join(databaseDirectory, 'test.sqlite') })
    let first = await database.connect()
    let second = await database.connect()

    try {
      await first.exec('create table accounts (id integer primary key, email text not null)')
      await first.exec("insert into accounts (id, email) values (1, 'a@example.com')")

      let rows = await second.query(accounts).orderBy('id', 'asc').all()

      assert.deepEqual(rows, [{ id: 1, email: 'a@example.com' }])
    } finally {
      await first.close()
      await second.close()
      await database.close()
      await rm(databaseDirectory, { force: true, recursive: true })
    }
  })

  it('rejects create and drop for a memory sqlite database resource', async () => {
    let database = createSqliteDatabase({ path: ':memory:' })

    await assert.rejects(
      () => database.create(),
      (error: unknown) =>
        error instanceof Error &&
        error.message === 'SQLite :memory: database resources do not support create()',
    )
    await assert.rejects(
      () => database.drop(),
      (error: unknown) =>
        error instanceof Error &&
        error.message === 'SQLite :memory: database resources do not support drop()',
    )
  })

  it('rejects multiple connections to a memory sqlite database resource', async () => {
    let database = createSqliteDatabase({ path: ':memory:' })
    let client = await database.connect()

    try {
      await assert.rejects(
        () => database.connect(),
        (error: unknown) =>
          error instanceof Error &&
          error.message ===
            'SQLite :memory: database resources only support one connection. Use a file-backed SQLite database when multiple connections need to share state.',
      )
    } finally {
      await client.close()
      await database.close()
    }
  })
})
