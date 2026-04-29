import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import type {
  DataManipulationRequest,
  DataMigrationRequest,
  DataMigrationResult,
  DataManipulationResult,
  DatabaseAdapter,
  TableRef,
  TransactionToken,
} from './adapter.ts'
import { parseTransactionDirective } from './migrations/directive.ts'
import { parseMigrationDirectoryName } from './migrations/directory-name.ts'
import { createMigrationRegistry } from './migrations/registry.ts'
import { createMigrationRunner } from './migrations/runner.ts'

type JournalRow = {
  id: string
  name: string
  checksum: string
  batch: number
  applied_at: string
}

class MemoryMigrationAdapter implements DatabaseAdapter {
  dialect = 'memory'
  capabilities = {
    returning: true,
    savepoints: true,
    upsert: true,
    transactionalDdl: true,
    migrationLock: true,
  }
  journalTableCreated = false
  journalTableName = 'data_table_migrations'
  journalRows: JournalRow[] = []
  executedScripts: Array<{ sql: string; transaction?: string }> = []
  scriptError: Error | undefined
  lockAcquireCount = 0
  lockReleaseCount = 0
  beginTransactionCount = 0
  commitTransactionCount = 0
  rollbackTransactionCount = 0
  #transactionCounter = 0
  #tokens = new Set<string>()

  compileSql() {
    return [{ text: '', values: [] }]
  }

  async execute(request: DataManipulationRequest): Promise<DataManipulationResult> {
    if (request.transaction) {
      this.#assertToken(request.transaction)
    }

    if (request.operation.kind !== 'raw') {
      throw new Error('MemoryMigrationAdapter only supports raw execute operations')
    }

    let statement = request.operation.sql
    let text = statement.text.toLowerCase()

    if (text.startsWith('select 1 from ')) {
      if (!this.journalTableCreated) {
        throw new Error('Journal table does not exist')
      }

      return { rows: [] }
    }

    if (text.includes('select id, name, checksum, batch, applied_at from ')) {
      if (!this.journalTableCreated) {
        throw new Error('Journal table does not exist')
      }

      return {
        rows: this.journalRows.map((row) => ({
          id: row.id,
          name: row.name,
          checksum: row.checksum,
          batch: row.batch,
          applied_at: row.applied_at,
        })),
      }
    }

    if (text.startsWith('insert into ')) {
      let [id, name, checksum, batch] = statement.values

      this.journalRows.push({
        id: String(id),
        name: String(name),
        checksum: String(checksum),
        batch: Number(batch),
        applied_at: new Date().toISOString(),
      })

      return { affectedRows: 1 }
    }

    if (text.startsWith('delete from ')) {
      let [id] = statement.values
      this.journalRows = this.journalRows.filter((row) => row.id !== String(id))

      return { affectedRows: 1 }
    }

    return { affectedRows: 0 }
  }

  async migrate(request: DataMigrationRequest): Promise<DataMigrationResult> {
    let operation = request.operation

    if (operation.kind === 'createTable' && operation.table.name === this.journalTableName) {
      this.journalTableCreated = true
      return { affectedOperations: 1 }
    }

    return { affectedOperations: 0 }
  }

  async executeScript(sql: string, transaction?: TransactionToken): Promise<void> {
    if (transaction) {
      this.#assertToken(transaction)
    }

    if (this.scriptError) {
      throw this.scriptError
    }

    this.executedScripts.push({ sql, transaction: transaction?.id })
  }

  async hasTable(table: TableRef, transaction?: TransactionToken): Promise<boolean> {
    if (transaction) {
      this.#assertToken(transaction)
    }

    return table.name === this.journalTableName && this.journalTableCreated
  }

  async hasColumn(_: TableRef, __: string, transaction?: TransactionToken): Promise<boolean> {
    if (transaction) {
      this.#assertToken(transaction)
    }

    return false
  }

  async beginTransaction(): Promise<TransactionToken> {
    this.beginTransactionCount += 1
    this.#transactionCounter += 1
    let token = { id: 'tx_' + String(this.#transactionCounter) }
    this.#tokens.add(token.id)
    return token
  }

  async commitTransaction(token: TransactionToken): Promise<void> {
    this.#assertToken(token)
    this.commitTransactionCount += 1
    this.#tokens.delete(token.id)
  }

  async rollbackTransaction(token: TransactionToken): Promise<void> {
    this.#assertToken(token)
    this.rollbackTransactionCount += 1
    this.#tokens.delete(token.id)
  }

  async createSavepoint(token: TransactionToken): Promise<void> {
    this.#assertToken(token)
  }

  async rollbackToSavepoint(token: TransactionToken): Promise<void> {
    this.#assertToken(token)
  }

  async releaseSavepoint(token: TransactionToken): Promise<void> {
    this.#assertToken(token)
  }

  async acquireMigrationLock(): Promise<void> {
    this.lockAcquireCount += 1
  }

  async releaseMigrationLock(): Promise<void> {
    this.lockReleaseCount += 1
  }

  #assertToken(token: TransactionToken): void {
    if (!this.#tokens.has(token.id)) {
      throw new Error('Unknown transaction token: ' + token.id)
    }
  }
}

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
    await assert.rejects(() => runner.up({ step: 0 }), /positive integer/)
    await assert.rejects(
      () => runner.up({ to: '20260101000000', step: 1 } as never),
      /Cannot combine "to" and "step"/,
    )
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
      },
    ])

    await assert.rejects(() => driftedRunner.up(), /checksum drift detected/)
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
