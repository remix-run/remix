import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import type {
  DataManipulationRequest,
  DataManipulationResult,
  DatabaseAdapter,
  TableRef,
  TransactionToken,
} from './adapter.ts'
import { createDatabase } from './database.ts'
import { createMigrator } from './migrations/migrator.ts'

type JournalRow = {
  id: string
  hash: string
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

    if (text.includes('select id, hash, batch, applied_at from ')) {
      if (!this.journalTableCreated) {
        throw new Error('Journal table does not exist')
      }

      return {
        rows: this.journalRows.map((row) => ({
          id: row.id,
          hash: row.hash,
          batch: row.batch,
          applied_at: row.applied_at,
        })),
      }
    }

    if (text.startsWith('insert into ')) {
      let [id, hash, batch] = statement.values

      this.journalRows.push({
        id: String(id),
        hash: String(hash),
        batch: Number(batch),
        applied_at: new Date().toISOString(),
      })

      return { affectedRows: 1 }
    }

    return { affectedRows: 0 }
  }

  async executeScript(sql: string, transaction?: TransactionToken): Promise<void> {
    if (transaction) {
      this.#assertToken(transaction)
    }

    if (sql.toLowerCase().startsWith('create table if not exists ' + this.journalTableName)) {
      this.journalTableCreated = true
      return
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

describe('migrator', () => {
  it('applies pending migrations through a connected database', async () => {
    let adapter = new MemoryMigrationAdapter()
    let migrator = createMigrator([
      { id: '20260101000000', sql: 'create table users (id integer)' },
      { id: '20260102000000', sql: 'create table posts (id integer)' },
    ])

    let result = await migrator.migrate(createDatabase(adapter))

    assert.deepEqual(result.applied, [
      { id: '20260101000000', sql: 'create table users (id integer)' },
      { id: '20260102000000', sql: 'create table posts (id integer)' },
    ])
    assert.deepEqual(
      adapter.executedScripts.map((entry) => entry.sql),
      ['create table users (id integer)', 'create table posts (id integer)'],
    )
    assert.deepEqual(
      adapter.journalRows.map((row) => row.id),
      ['20260101000000', '20260102000000'],
    )
  })

  it('sorts migrations by id and rejects duplicate ids', () => {
    let adapter = new MemoryMigrationAdapter()
    let migrator = createMigrator([
      { id: '20260102000000', sql: 'create table b (id integer)' },
      { id: '20260101000000', sql: 'create table a (id integer)' },
    ])

    assert.doesNotThrow(() => migrator.migrate(createDatabase(adapter)))
    assert.throws(
      () =>
        createMigrator([
          { id: '20260101000000', sql: 'select 1' },
          { id: '20260101000000', sql: 'select 2' },
        ]),
      /Duplicate migration id/,
    )
  })

  it('applies pending migrations up to a target id', async () => {
    let adapter = new MemoryMigrationAdapter()
    let migrator = createMigrator([
      { id: '20260101000000', sql: 'create table users (id integer)' },
      { id: '20260102000000', sql: 'create table posts (id integer)' },
    ])

    await migrator.migrate(createDatabase(adapter), { to: '20260101000000' })

    assert.deepEqual(
      adapter.journalRows.map((row) => row.id),
      ['20260101000000'],
    )
  })

  it('rejects unknown migration targets', async () => {
    let adapter = new MemoryMigrationAdapter()
    let migrator = createMigrator([{ id: '20260101000000', sql: 'select 1' }])

    await assert.rejects(
      () => migrator.migrate(createDatabase(adapter), { to: '99999999999999' }),
      /Unknown migration target/,
    )
  })

  it('skips executing empty migrations but still updates the journal', async () => {
    let adapter = new MemoryMigrationAdapter()
    let migrator = createMigrator([{ id: '20260101000000', sql: '   \n  ' }])

    await migrator.migrate(createDatabase(adapter))

    assert.equal(adapter.executedScripts.length, 0)
    assert.equal(adapter.journalRows.length, 1)
  })

  it('wraps each migration in its own transaction when supported', async () => {
    let adapter = new MemoryMigrationAdapter()
    let migrator = createMigrator([
      { id: '20260101000000', sql: 'create table a (id integer)' },
      { id: '20260102000000', sql: 'create table b (id integer)' },
    ])

    await migrator.migrate(createDatabase(adapter))

    assert.equal(adapter.beginTransactionCount, 2)
    assert.equal(adapter.commitTransactionCount, 2)
    let txIds = adapter.executedScripts.map((entry) => entry.transaction)
    assert.notEqual(txIds[0], undefined)
    assert.notEqual(txIds[1], undefined)
    assert.notEqual(txIds[0], txIds[1])
  })

  it('skips transactions when the adapter lacks transactional DDL', async () => {
    let adapter = new MemoryMigrationAdapter()
    adapter.capabilities.transactionalDdl = false
    let migrator = createMigrator([{ id: '20260101000000', sql: 'create table a (id integer)' }])

    await migrator.migrate(createDatabase(adapter))

    assert.equal(adapter.beginTransactionCount, 0)
    assert.equal(adapter.executedScripts[0].transaction, undefined)
  })

  it('balances migration lock hooks and rolls back when execution fails', async () => {
    let adapter = new MemoryMigrationAdapter()
    adapter.scriptError = new Error('boom')
    let migrator = createMigrator([{ id: '20260101000000', sql: 'select 1' }])

    await assert.rejects(() => migrator.migrate(createDatabase(adapter)), /boom/)

    assert.equal(adapter.lockAcquireCount, 1)
    assert.equal(adapter.lockReleaseCount, 1)
    assert.equal(adapter.rollbackTransactionCount, 1)
    assert.equal(adapter.commitTransactionCount, 0)
  })

  it('reports applied, pending, and drifted statuses without making drift contagious', async () => {
    let adapter = new MemoryMigrationAdapter()
    let migrator = createMigrator([
      { id: '20260101000000', sql: 'create table users (id integer)' },
      { id: '20260102000000', sql: 'create table posts (id integer)' },
      { id: '20260103000000', sql: 'create table comments (id integer)' },
    ])

    await migrator.migrate(createDatabase(adapter))

    let driftedMigrator = createMigrator([
      { id: '20260101000000', sql: 'create table users (id integer)' },
      { id: '20260102000000', sql: 'create table posts (id integer, title text)' },
      { id: '20260103000000', sql: 'create table comments (id integer)' },
      { id: '20260104000000', sql: 'create table likes (id integer)' },
    ])
    let statuses = await driftedMigrator.status(createDatabase(adapter))

    assert.deepEqual(
      statuses.map((status) => ({ id: status.id, status: status.status })),
      [
        { id: '20260101000000', status: 'applied' },
        { id: '20260102000000', status: 'drifted' },
        { id: '20260103000000', status: 'applied' },
        { id: '20260104000000', status: 'pending' },
      ],
    )
  })

  it('refuses to apply migrations when drift exists', async () => {
    let adapter = new MemoryMigrationAdapter()
    let migrator = createMigrator([{ id: '20260101000000', sql: 'select 1' }])

    await migrator.migrate(createDatabase(adapter))

    let driftedMigrator = createMigrator([
      { id: '20260101000000', sql: 'select 2' },
      { id: '20260102000000', sql: 'select 3' },
    ])

    await assert.rejects(
      () => driftedMigrator.migrate(createDatabase(adapter)),
      /hash drift detected/,
    )
    assert.equal(adapter.journalRows.length, 1)
  })
})
