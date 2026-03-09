import * as assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { loadMigrations } from './migrations-node.ts'

describe('migration node loader', () => {
  it('loads migrations and infers ids and names from filenames', async () => {
    let directory = await mkdtemp(path.join(tmpdir(), 'data-table-migrations-'))

    try {
      await writeFile(
        path.join(directory, '20260101000000_create_users.mjs'),
        ['export default {', '  async up() {},', '  async down() {},', '}', ''].join('\n'),
      )

      await writeFile(
        path.join(directory, '20260102000000_add_posts.mjs'),
        ['export default {', '  async up() {},', '  async down() {},', '}', ''].join('\n'),
      )

      let migrations = await loadMigrations(directory)

      assert.equal(migrations.length, 2)
      assert.equal(migrations[0].id, '20260101000000')
      assert.equal(migrations[0].name, 'create_users')
      assert.equal(migrations[1].id, '20260102000000')
      assert.equal(migrations[1].name, 'add_posts')
      assert.match(migrations[0].checksum ?? '', /^[a-f0-9]{64}$/)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('throws for invalid migration filename formats', async () => {
    let directory = await mkdtemp(path.join(tmpdir(), 'data-table-migrations-'))

    try {
      await writeFile(
        path.join(directory, 'create_users.mjs'),
        ['export default {', '  async up() {},', '  async down() {},', '}', ''].join('\n'),
      )

      await assert.rejects(
        () => loadMigrations(directory),
        /Expected format YYYYMMDDHHmmss_name\.ts/,
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('throws for duplicate ids inferred from filenames', async () => {
    let directory = await mkdtemp(path.join(tmpdir(), 'data-table-migrations-'))

    try {
      await writeFile(
        path.join(directory, '20260101000000_create_users.mjs'),
        ['export default {', '  async up() {},', '  async down() {},', '}', ''].join('\n'),
      )

      await writeFile(
        path.join(directory, '20260101000000_add_users_index.mjs'),
        ['export default {', '  async up() {},', '  async down() {},', '}', ''].join('\n'),
      )

      await assert.rejects(() => loadMigrations(directory), /Duplicate migration id/)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
