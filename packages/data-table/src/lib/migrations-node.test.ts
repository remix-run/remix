import * as assert from '@remix-run/assert'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from '@remix-run/test'

import { loadMigrations } from './migrations-node.ts'

async function makeMigration(
  parent: string,
  directoryName: string,
  files: { up?: string; down?: string },
): Promise<void> {
  let directoryPath = path.join(parent, directoryName)
  await mkdir(directoryPath, { recursive: true })

  if (files.up !== undefined) {
    await writeFile(path.join(directoryPath, 'up.sql'), files.up)
  }

  if (files.down !== undefined) {
    await writeFile(path.join(directoryPath, 'down.sql'), files.down)
  }
}

describe('migration node loader', () => {
  it('loads migrations from directories and infers ids and names', async () => {
    let directory = await mkdtemp(path.join(tmpdir(), 'data-table-migrations-'))

    try {
      await makeMigration(directory, '20260101000000_create_users', {
        up: 'create table users (id integer)',
        down: 'drop table users',
      })
      await makeMigration(directory, '20260102000000_add_posts', {
        up: 'create table posts (id integer)',
        down: 'drop table posts',
      })

      let migrations = await loadMigrations(directory)

      assert.equal(migrations.length, 2)
      assert.equal(migrations[0].id, '20260101000000')
      assert.equal(migrations[0].name, 'create_users')
      assert.equal(migrations[0].up, 'create table users (id integer)')
      assert.equal(migrations[0].down, 'drop table users')
      assert.equal(migrations[1].id, '20260102000000')
      assert.equal(migrations[1].name, 'add_posts')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('treats down.sql as optional', async () => {
    let directory = await mkdtemp(path.join(tmpdir(), 'data-table-migrations-'))

    try {
      await makeMigration(directory, '20260101000000_irreversible', {
        up: 'create table users (id integer)',
      })

      let migrations = await loadMigrations(directory)

      assert.equal(migrations.length, 1)
      assert.equal(migrations[0].down, undefined)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('throws when up.sql is missing', async () => {
    let directory = await mkdtemp(path.join(tmpdir(), 'data-table-migrations-'))

    try {
      await makeMigration(directory, '20260101000000_missing_up', { down: 'select 1' })

      await assert.rejects(() => loadMigrations(directory), /missing up\.sql/)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('throws for invalid migration directory names', async () => {
    let directory = await mkdtemp(path.join(tmpdir(), 'data-table-migrations-'))

    try {
      await makeMigration(directory, 'create_users', { up: 'select 1' })

      await assert.rejects(() => loadMigrations(directory), /Expected format YYYYMMDDHHmmss_name/)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('throws for duplicate ids inferred from directory names', async () => {
    let directory = await mkdtemp(path.join(tmpdir(), 'data-table-migrations-'))

    try {
      await makeMigration(directory, '20260101000000_create_users', { up: 'select 1' })
      await makeMigration(directory, '20260101000000_add_users_index', { up: 'select 1' })

      await assert.rejects(() => loadMigrations(directory), /Duplicate migration id/)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('ignores non-directory entries', async () => {
    let directory = await mkdtemp(path.join(tmpdir(), 'data-table-migrations-'))

    try {
      await makeMigration(directory, '20260101000000_create_users', { up: 'select 1' })
      await writeFile(path.join(directory, 'README.md'), '# notes')

      let migrations = await loadMigrations(directory)
      assert.equal(migrations.length, 1)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
