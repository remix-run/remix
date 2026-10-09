import * as assert from '@remix-run/assert'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from '@remix-run/test'

import type { Database } from './database.ts'
import { loadMigrations, loadSeed } from './migrations-node.ts'
import { createMigrationRunner } from './migrations/runner.ts'
import { MemoryMigrationDriver } from '../../test/memory-migration-driver.ts'

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

  it('loads zero-padded sequential ids and runs migrations in numeric order', async () => {
    let directory = await mkdtemp(path.join(tmpdir(), 'data-table-migrations-'))

    try {
      await makeMigration(directory, '0010_add_index', {
        up: 'create index users_name on users (name)',
        down: 'drop index users_name',
      })
      await makeMigration(directory, '0002_add_name', {
        up: 'alter table users add column name text',
        down: 'alter table users drop column name',
      })
      await makeMigration(directory, '0001_create_users', {
        up: 'create table users (id integer)',
        down: 'drop table users',
      })

      let migrations = await loadMigrations(directory)
      assert.deepEqual(
        migrations.map(({ id, name }) => ({ id, name })),
        [
          { id: '0001', name: 'create_users' },
          { id: '0002', name: 'add_name' },
          { id: '0010', name: 'add_index' },
        ],
      )

      let driver = new MemoryMigrationDriver()
      let runner = createMigrationRunner(driver, migrations)
      let applied = await runner.up({ to: '0002_add_name' })
      assert.deepEqual(
        applied.applied.map((migration) => migration.id),
        ['0001', '0002'],
      )

      let remaining = await runner.up()
      assert.deepEqual(
        remaining.applied.map((migration) => migration.id),
        ['0010'],
      )

      let reverted = await runner.down({ to: '0002' })
      assert.deepEqual(
        reverted.reverted.map((migration) => migration.id),
        ['0010', '0002'],
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('rejects ids with different digit counts', async () => {
    let directory = await mkdtemp(path.join(tmpdir(), 'data-table-migrations-'))

    try {
      await makeMigration(directory, '2_second', { up: 'select 2' })
      await makeMigration(directory, '10_tenth', { up: 'select 10' })

      await assert.rejects(
        () => loadMigrations(directory),
        /Migration directory "2_second" has a 1-digit prefix; expected 2 digits/,
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('loads an empty migration directory', async () => {
    let directory = await mkdtemp(path.join(tmpdir(), 'data-table-migrations-'))

    try {
      assert.deepEqual(await loadMigrations(directory), [])
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

      await assert.rejects(() => loadMigrations(directory), /Expected format <digits>_<name>/)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('throws for duplicate ids inferred from directory names', async () => {
    let directory = await mkdtemp(path.join(tmpdir(), 'data-table-migrations-'))

    try {
      await makeMigration(directory, '0001_create_users', { up: 'select 1' })
      await makeMigration(directory, '0001_add_users_index', { up: 'select 1' })

      await assert.rejects(() => loadMigrations(directory), /Duplicate migration id/)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('targets loaded migrations by their full directory name', async () => {
    let directory = await mkdtemp(path.join(tmpdir(), 'data-table-migrations-'))

    try {
      await makeMigration(directory, '20260101000000_create_users', {
        up: 'create table users (id integer)',
      })
      await makeMigration(directory, '20260102000000_add_posts', {
        up: 'create table posts (id integer)',
      })

      let migrations = await loadMigrations(directory)
      let driver = new MemoryMigrationDriver()
      let runner = createMigrationRunner(driver, migrations)

      await runner.up({ to: '20260101000000_create_users' })

      assert.deepEqual(
        driver.journalRows.map((row) => row.id),
        ['20260101000000'],
      )
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

describe('seed node loader', () => {
  it('loads a SQL file as a seed function that runs the whole script', async () => {
    let directory = await mkdtemp(path.join(tmpdir(), 'data-table-seed-'))

    try {
      let sql =
        "insert into users (name) values ('demo');\ninsert into users (name) values ('admin');\n"
      await writeFile(path.join(directory, 'seed.sql'), sql)

      let seed = await loadSeed(path.join(directory, 'seed.sql'))

      let scripts: string[] = []
      let db = {
        executeScript(script: string) {
          scripts.push(script)
        },
      } as unknown as Database
      await seed(db)

      assert.deepEqual(scripts, [sql])
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('rejects when the seed file is missing', async () => {
    let directory = await mkdtemp(path.join(tmpdir(), 'data-table-seed-'))

    try {
      await assert.rejects(() => loadSeed(path.join(directory, 'seed.sql')))
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
