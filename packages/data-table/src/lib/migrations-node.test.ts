import * as assert from '@remix-run/assert'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from '@remix-run/test'

import { loadMigrations } from './migrations-node.ts'

async function makeMigration(parent: string, fileName: string, sql: string): Promise<void> {
  await writeFile(path.join(parent, fileName), sql)
}

describe('migration node loader', () => {
  it('loads migrations from SQL files and infers ids from filenames', async () => {
    let directory = await mkdtemp(path.join(tmpdir(), 'data-table-migrations-'))

    try {
      await makeMigration(
        directory,
        '20260101000000_create_users.sql',
        'create table users (id integer)',
      )
      await makeMigration(
        directory,
        '20260102000000_add_posts.sql',
        'create table posts (id integer)',
      )

      let migrations = await loadMigrations(directory)

      assert.equal(migrations.length, 2)
      assert.equal(migrations[0].id, '20260101000000_create_users')
      assert.equal(migrations[0].sql, 'create table users (id integer)')
      assert.equal(migrations[1].id, '20260102000000_add_posts')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('ignores non-SQL files and directories', async () => {
    let directory = await mkdtemp(path.join(tmpdir(), 'data-table-migrations-'))

    try {
      await makeMigration(directory, '20260101000000_create_users.sql', 'select 1')
      await writeFile(path.join(directory, 'README.md'), '# notes')
      await mkdir(path.join(directory, '20260102000000_add_posts'))

      let migrations = await loadMigrations(directory)
      assert.equal(migrations.length, 1)
      assert.equal(migrations[0].id, '20260101000000_create_users')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
