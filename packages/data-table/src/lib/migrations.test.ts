import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import type { DatabaseAdapter } from './adapter.ts'
import { Database } from './database.ts'
import { parseTransactionDirective } from './migrations/directive.ts'
import { parseMigrationDirectoryName } from './migrations/directory-name.ts'
import { createMigrationRegistry } from './migrations/registry.ts'
import { createMigrationRunner } from './migrations/runner.ts'
import { MemoryMigrationAdapter } from '../../test/memory-migration-adapter.ts'

describe('Database migrations', () => {
  it('applies and reverts migrations through Database.migrate()', async () => {
    let adapter = new MemoryMigrationAdapter()
    let db = new Database(adapter)
    let migrations = [
      {
        id: '20260101000000',
        name: 'create_users',
        up: 'create table users (id integer)',
        down: 'drop table users',
      },
    ]

    let applied = await db.migrate(migrations)
    assert.deepEqual(
      applied.applied.map((entry) => entry.id),
      ['20260101000000'],
    )

    let reverted = await db.migrate(migrations, { direction: 'down', step: 1 })
    assert.deepEqual(
      reverted.reverted.map((entry) => entry.id),
      ['20260101000000'],
    )
    assert.equal(adapter.journalRows.length, 0)
  })

  it('uses journal configuration for migrate and status', async () => {
    let adapter = new MemoryMigrationAdapter()
    adapter.journalTableName = 'app_migrations'
    let db = new Database(adapter)
    let migrations = [{ id: '20260101000000', name: 'users', up: 'select 1' }]

    await db.migrate(migrations, { journalTable: 'app_migrations' })
    await db.migrationStatus(migrations, { journalTable: 'app_migrations' })

    assert.equal(adapter.journalTableName, 'app_migrations')
  })

  it('supports targets, steps, and dry runs through Database.migrate()', async () => {
    let adapter = new MemoryMigrationAdapter()
    let db = new Database(adapter)
    let migrations = [
      { id: '20260101000000', name: 'users', up: 'create table users (id integer)' },
      { id: '20260102000000', name: 'posts', up: 'create table posts (id integer)' },
    ]

    let plan = await db.migrate(migrations, { dryRun: true, step: 1 })
    assert.deepEqual(plan.sql, ['create table users (id integer)'])
    assert.equal(adapter.journalRows.length, 0)

    await db.migrate(migrations, { to: '20260101000000_users' })
    assert.deepEqual(
      adapter.journalRows.map((row) => row.id),
      ['20260101000000'],
    )
  })

  it('reports pending migrations without creating a journal table', async () => {
    let adapter = new MemoryMigrationAdapter()
    let db = new Database(adapter)
    let migrations = [{ id: '20260101000000', name: 'users', up: 'select 1' }]

    let status = await db.migrationStatus(migrations)

    assert.deepEqual(status, [
      {
        id: '20260101000000',
        name: 'users',
        status: 'pending',
      },
    ])
    assert.equal(adapter.journalTableCreated, false)
  })
})

describe('migration runner', () => {
  it('applies pending migrations and records them in the journal', async () => {
    let adapter = new MemoryMigrationAdapter()
    let runner = createMigrationRunner(adapter, [
      {
        id: '20260101000000',
        name: 'create_users',
        up: 'create table users (id integer)',
        down: 'drop table users',
      },
      {
        id: '20260102000000',
        name: 'create_posts',
        up: 'create table posts (id integer)',
        down: 'drop table posts',
      },
    ])

    let result = await runner.up()

    assert.deepEqual(
      result.applied.map((entry) => entry.id),
      ['20260101000000', '20260102000000'],
    )
    assert.deepEqual(
      adapter.executedScripts.map((entry) => entry.sql),
      ['create table users (id integer)', 'create table posts (id integer)'],
    )
    assert.deepEqual(
      adapter.journalRows.map((row) => row.id),
      ['20260101000000', '20260102000000'],
    )
  })

  it('reverts applied migrations using their down script', async () => {
    let adapter = new MemoryMigrationAdapter()
    let migrations = [
      {
        id: '20260101000000',
        name: 'create_users',
        up: 'create table users (id integer)',
        down: 'drop table users',
      },
      {
        id: '20260102000000',
        name: 'create_posts',
        up: 'create table posts (id integer)',
        down: 'drop table posts',
      },
    ]
    let runner = createMigrationRunner(adapter, migrations)

    await runner.up()
    adapter.executedScripts = []

    await runner.down({ step: 1 })

    assert.deepEqual(
      adapter.executedScripts.map((entry) => entry.sql),
      ['drop table posts'],
    )
    assert.deepEqual(
      adapter.journalRows.map((row) => row.id),
      ['20260101000000'],
    )

    await runner.down({ to: '20260101000000' })
    assert.deepEqual(adapter.journalRows, [])
  })

  it('throws when reverting a migration that has no down script', async () => {
    let adapter = new MemoryMigrationAdapter()
    let runner = createMigrationRunner(adapter, [
      {
        id: '20260101000000',
        name: 'irreversible',
        up: 'create table users (id integer)',
      },
    ])

    await runner.up()
    await assert.rejects(() => runner.down(), /has no down script/)
  })

  it('skips executing empty scripts but still updates the journal', async () => {
    let adapter = new MemoryMigrationAdapter()
    let runner = createMigrationRunner(adapter, [
      { id: '20260101000000', name: 'noop', up: '   \n  ', down: '' },
    ])

    await runner.up()

    assert.equal(adapter.executedScripts.length, 0)
    assert.equal(adapter.journalRows.length, 1)

    await runner.down()
    assert.equal(adapter.executedScripts.length, 0)
    assert.equal(adapter.journalRows.length, 0)
  })

  it('supports dryRun without executing or journaling', async () => {
    let adapter = new MemoryMigrationAdapter()
    let runner = createMigrationRunner(adapter, [
      { id: '20260101000000', name: 'create_users', up: 'create table users (id integer)' },
    ])

    let result = await runner.up({ dryRun: true })

    assert.deepEqual(result.sql, ['create table users (id integer)'])
    assert.equal(adapter.executedScripts.length, 0)
    assert.equal(adapter.journalRows.length, 0)
  })

  it('respects target and step boundaries on up()', async () => {
    let adapter = new MemoryMigrationAdapter()
    let migrations = [
      { id: '20260101000000', name: 'a', up: 'create table a (id integer)' },
      { id: '20260102000000', name: 'b', up: 'create table b (id integer)' },
    ]

    let targetRunner = createMigrationRunner(adapter, migrations)
    await targetRunner.up({ to: '20260101000000' })
    assert.deepEqual(
      adapter.journalRows.map((row) => row.id),
      ['20260101000000'],
    )

    adapter.journalRows = []
    adapter.journalTableCreated = false
    adapter.executedScripts = []

    let stepRunner = createMigrationRunner(adapter, migrations)
    await stepRunner.up({ step: 1 })
    assert.deepEqual(
      adapter.journalRows.map((row) => row.id),
      ['20260101000000'],
    )
  })

  it('rejects invalid options', async () => {
    let adapter = new MemoryMigrationAdapter()
    let runner = createMigrationRunner(adapter, [
      { id: '20260101000000', name: 'a', up: 'create table a (id integer)' },
    ])

    await assert.rejects(() => runner.up({ to: '99999999999999' }), /Unknown migration target/)
    await assert.rejects(() => runner.up({ to: '20260101000000_nope' }), /Unknown migration target/)
    await assert.rejects(() => runner.up({ step: 0 }), /positive integer/)
    await assert.rejects(
      () => runner.up({ to: '20260101000000', step: 1 } as never),
      /Cannot combine "to" and "step"/,
    )
  })

  it('resolves full id_name targets against bare migration ids', async () => {
    let adapter = new MemoryMigrationAdapter()
    let migrations = [
      {
        id: '20260101000000',
        name: 'create_users',
        up: 'create table users (id integer)',
        down: 'drop table users',
      },
      {
        id: '20260102000000',
        name: 'create_posts',
        up: 'create table posts (id integer)',
        down: 'drop table posts',
      },
    ]
    let runner = createMigrationRunner(adapter, migrations)

    await runner.up({ to: '20260101000000_create_users' })
    assert.deepEqual(
      adapter.journalRows.map((row) => row.id),
      ['20260101000000'],
    )

    await runner.up()
    await runner.down({ to: '20260102000000_create_posts' })
    assert.deepEqual(
      adapter.journalRows.map((row) => row.id),
      ['20260101000000'],
    )
  })

  it('rejects ambiguous migration targets', async () => {
    let adapter = new MemoryMigrationAdapter()
    let runner = createMigrationRunner(adapter, [
      { id: '20260101000000', name: 'a', up: 'select 1' },
      { id: '20260101000000_a', name: 'b', up: 'select 1' },
    ])

    await assert.rejects(() => runner.up({ to: '20260101000000_a' }), /Ambiguous migration target/)
  })

  it('detects checksum drift from changed up.sql', async () => {
    let adapter = new MemoryMigrationAdapter()
    let runner = createMigrationRunner(adapter, [
      {
        id: '20260101000000',
        name: 'users',
        up: 'create table users (id integer)',
      },
    ])

    await runner.up()

    let driftedRunner = createMigrationRunner(adapter, [
      {
        id: '20260101000000',
        name: 'users',
        up: 'create table users (id integer, email text)',
        down: 'drop table users',
      },
    ])

    await assert.rejects(() => driftedRunner.up(), /checksum drift detected/)
    await assert.rejects(() => driftedRunner.down(), /checksum drift detected/)
  })

  it('rejects up() when an applied migration is missing but still allows down()', async () => {
    let adapter = new MemoryMigrationAdapter()
    let runner = createMigrationRunner(adapter, [
      {
        id: '20260101000000',
        name: 'create_users',
        up: 'create table users (id integer)',
        down: 'drop table users',
      },
      {
        id: '20260102000000',
        name: 'create_posts',
        up: 'create table posts (id integer)',
        down: 'drop table posts',
      },
    ])

    await runner.up()
    adapter.executedScripts = []

    let orphanedRunner = createMigrationRunner(adapter, [
      {
        id: '20260102000000',
        name: 'create_posts',
        up: 'create table posts (id integer)',
        down: 'drop table posts',
      },
    ])

    await assert.rejects(
      () => orphanedRunner.up(),
      /Applied migration "20260101000000_create_users" is missing from current migrations/,
    )
    assert.equal(adapter.executedScripts.length, 0)

    let result = await orphanedRunner.down()

    assert.deepEqual(
      result.reverted.map((entry) => entry.id),
      ['20260102000000'],
    )
    assert.deepEqual(
      adapter.executedScripts.map((entry) => entry.sql),
      ['drop table posts'],
    )
    assert.deepEqual(
      adapter.journalRows.map((row) => row.id),
      ['20260101000000'],
    )
  })

  it('balances migration lock hooks when execution fails', async () => {
    let adapter = new MemoryMigrationAdapter()
    adapter.scriptError = new Error('boom')

    let runner = createMigrationRunner(adapter, [
      { id: '20260101000000', name: 'broken', up: 'select 1' },
    ])

    await assert.rejects(() => runner.up(), /boom/)
    assert.equal(adapter.lockAcquireCount, 1)
    assert.equal(adapter.lockReleaseCount, 1)
    assert.equal(adapter.rollbackTransactionCount, 1)
    assert.equal(adapter.commitTransactionCount, 0)
  })

  it('runs journal reads/writes and scripts through the lock-owning adapter', async () => {
    let lockAdapter = new MemoryMigrationAdapter()

    class LockDelegatingAdapter extends MemoryMigrationAdapter {
      override async withMigrationLock<result>(
        _name: string,
        run: (adapter: DatabaseAdapter) => Promise<result>,
      ): Promise<result> {
        return run(lockAdapter)
      }
    }

    let adapter = new LockDelegatingAdapter()
    let runner = createMigrationRunner(adapter, [
      { id: '20260101000000', name: 'create_users', up: 'create table users (id integer)' },
    ])

    await runner.up()

    assert.equal(lockAdapter.journalTableCreated, true)
    assert.deepEqual(
      lockAdapter.executedScripts.map((entry) => entry.sql),
      ['create table users (id integer)'],
    )
    assert.deepEqual(
      lockAdapter.journalRows.map((row) => row.id),
      ['20260101000000'],
    )
    assert.equal(lockAdapter.beginTransactionCount, 1)
    assert.equal(adapter.journalTableCreated, false)
    assert.equal(adapter.executedScripts.length, 0)
    assert.equal(adapter.journalRows.length, 0)
    assert.equal(adapter.beginTransactionCount, 0)
  })

  it('wraps each migration in its own transaction by default', async () => {
    let adapter = new MemoryMigrationAdapter()
    let runner = createMigrationRunner(adapter, [
      { id: '20260101000000', name: 'a', up: 'create table a (id integer)' },
      { id: '20260102000000', name: 'b', up: 'create table b (id integer)' },
    ])

    await runner.up()

    assert.equal(adapter.beginTransactionCount, 2)
    assert.equal(adapter.commitTransactionCount, 2)
    let txIds = adapter.executedScripts.map((entry) => entry.transaction)
    assert.notEqual(txIds[0], undefined)
    assert.notEqual(txIds[1], undefined)
    assert.notEqual(txIds[0], txIds[1])
  })

  it('skips transactions when descriptor sets transaction: none', async () => {
    let adapter = new MemoryMigrationAdapter()
    let runner = createMigrationRunner(adapter, [
      {
        id: '20260101000000',
        name: 'concurrent',
        up: 'create index concurrently users_email_idx on users (email)',
        transaction: 'none',
      },
    ])

    await runner.up()

    assert.equal(adapter.beginTransactionCount, 0)
    assert.equal(adapter.executedScripts[0].transaction, undefined)
  })

  it('respects -- data-table/transaction directive when descriptor omits the field', async () => {
    let adapter = new MemoryMigrationAdapter()
    let runner = createMigrationRunner(adapter, [
      {
        id: '20260101000000',
        name: 'concurrent',
        up: '-- data-table/transaction: none\ncreate index concurrently users_email_idx on users (email)',
      },
    ])

    await runner.up()

    assert.equal(adapter.beginTransactionCount, 0)
  })

  it('throws when transaction: required but adapter lacks transactional DDL', async () => {
    let adapter = new MemoryMigrationAdapter()
    adapter.capabilities.transactionalDdl = false

    let runner = createMigrationRunner(adapter, [
      {
        id: '20260101000000',
        name: 'tx_required',
        up: 'create table a (id integer)',
        transaction: 'required',
      },
    ])

    await assert.rejects(() => runner.up(), /requires transactional DDL/)
  })

  it('skips wrapping when adapter lacks transactional DDL and mode is auto', async () => {
    let adapter = new MemoryMigrationAdapter()
    adapter.capabilities.transactionalDdl = false

    let runner = createMigrationRunner(adapter, [
      { id: '20260101000000', name: 'a', up: 'create table a (id integer)' },
    ])

    await runner.up()

    assert.equal(adapter.beginTransactionCount, 0)
    assert.equal(adapter.executedScripts.length, 1)
  })

  it('reports drifted, applied, and pending statuses', async () => {
    let adapter = new MemoryMigrationAdapter()
    let runner = createMigrationRunner(adapter, [
      { id: '20260101000000', name: 'a', up: 'create table a (id integer)' },
      { id: '20260102000000', name: 'b', up: 'create table b (id integer)' },
    ])

    await runner.up({ step: 1 })

    let driftedRunner = createMigrationRunner(adapter, [
      { id: '20260101000000', name: 'a', up: 'create table a (id integer, email text)' },
      { id: '20260102000000', name: 'b', up: 'create table b (id integer)' },
    ])
    let statuses = await driftedRunner.status()

    assert.deepEqual(
      statuses.map((status) => ({ id: status.id, status: status.status })),
      [
        { id: '20260101000000', status: 'drifted' },
        { id: '20260102000000', status: 'pending' },
      ],
    )
  })

  it('reports applied journal entries missing from the current migrations', async () => {
    let adapter = new MemoryMigrationAdapter()
    let runner = createMigrationRunner(adapter, [
      { id: '20260101000000', name: 'create_users', up: 'create table users (id integer)' },
    ])

    await runner.up()

    let statusRunner = createMigrationRunner(adapter, [
      { id: '20260102000000', name: 'create_posts', up: 'create table posts (id integer)' },
    ])
    let statuses = await statusRunner.status()

    assert.deepEqual(
      statuses.map((status) => ({ id: status.id, name: status.name, status: status.status })),
      [
        { id: '20260101000000', name: 'create_users', status: 'missing' },
        { id: '20260102000000', name: 'create_posts', status: 'pending' },
      ],
    )
    assert.equal(statuses[0].appliedAt instanceof Date, true)
    assert.equal(statuses[0].batch, 1)
    assert.equal(typeof statuses[0].checksum, 'string')
  })
})

describe('migration registry', () => {
  it('sorts migrations by id and rejects duplicate ids', () => {
    let first = { id: '20260101000000', name: 'first', up: 'select 1' }
    let second = { id: '20260102000000', name: 'second', up: 'select 1' }

    let registry = createMigrationRegistry([second, first])
    assert.deepEqual(
      registry.list().map((migration) => migration.id),
      ['20260101000000', '20260102000000'],
    )

    assert.throws(
      () => createMigrationRegistry([first, { ...first, name: 'duplicate' }]),
      /Duplicate migration id/,
    )

    assert.throws(
      () => registry.register({ ...first, name: 'duplicate' }),
      /Duplicate migration id/,
    )
  })

  it('runs migrations supplied via a registry', async () => {
    let adapter = new MemoryMigrationAdapter()
    let registry = createMigrationRegistry()

    registry.register({
      id: '20260101000000',
      name: 'users',
      up: 'create table users (id integer)',
    })

    let runner = createMigrationRunner(adapter, registry)
    await runner.up()

    assert.deepEqual(
      adapter.journalRows.map((row) => row.id),
      ['20260101000000'],
    )
  })
})

describe('migration directory name parsing', () => {
  it('parses migration ids and names from standard directory names', () => {
    assert.deepEqual(parseMigrationDirectoryName('20260101010101_create_users'), {
      id: '20260101010101',
      name: 'create_users',
    })
  })

  it('rejects invalid migration directory names', () => {
    assert.throws(
      () => parseMigrationDirectoryName('create_users'),
      /Expected format YYYYMMDDHHmmss_name/,
    )
  })
})

describe('transaction directive parser', () => {
  it('returns the declared mode when present', () => {
    assert.equal(parseTransactionDirective('-- data-table/transaction: none\nselect 1'), 'none')
    assert.equal(
      parseTransactionDirective('-- data-table/transaction: required\nselect 1'),
      'required',
    )
    assert.equal(parseTransactionDirective('-- data-table/transaction: auto'), 'auto')
  })

  it('returns undefined when no directive is present', () => {
    assert.equal(parseTransactionDirective('select 1'), undefined)
    assert.equal(parseTransactionDirective('-- regular comment\nselect 1'), undefined)
  })

  it('throws when more than one directive is present', () => {
    assert.throws(
      () =>
        parseTransactionDirective(
          '-- data-table/transaction: none\n-- data-table/transaction: auto',
        ),
      /more than one transaction directive/,
    )
  })
})
