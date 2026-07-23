import type {
  DataManipulationRequest,
  DataManipulationResult,
  DatabaseAdapter,
  TableRef,
  TransactionToken,
} from '../src/lib/adapter.ts'

export type JournalRow = {
  id: string
  name: string
  checksum: string
  batch: number
  applied_at: string
}

export class MemoryMigrationAdapter implements DatabaseAdapter {
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

  async withMigrationLock<result>(
    _name: string,
    run: (adapter: DatabaseAdapter) => Promise<result>,
  ): Promise<result> {
    this.lockAcquireCount += 1
    try {
      return await run(this)
    } finally {
      this.lockReleaseCount += 1
    }
  }

  #assertToken(token: TransactionToken): void {
    if (!this.#tokens.has(token.id)) {
      throw new Error('Unknown transaction token: ' + token.id)
    }
  }
}
