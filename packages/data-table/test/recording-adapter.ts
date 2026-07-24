import type {
  DatabaseCapabilities,
  DataManipulationRequest,
  DataManipulationResult,
  DatabaseAdapter,
  TableRef,
  TransactionOptions,
  TransactionToken,
} from '../src/lib/adapter.ts'
import { DatabaseImplementation, type DatabaseOptions } from '../src/lib/database.ts'
import type { SqlStatement } from '../src/lib/sql.ts'

export type RecordingAdapterOptions = {
  dialect?: string
  capabilities?: Partial<DatabaseCapabilities>
  execute?(request: DataManipulationRequest): Promise<DataManipulationResult>
}

export type RecordingAdapter = {
  adapter: DatabaseAdapter
  requests: DataManipulationRequest[]
  transactions: Array<
    | { kind: 'begin'; options: TransactionOptions | undefined; token: TransactionToken }
    | { kind: 'commit'; token: TransactionToken }
    | { kind: 'rollback'; token: TransactionToken }
    | { kind: 'createSavepoint'; token: TransactionToken; name: string }
    | { kind: 'rollbackToSavepoint'; token: TransactionToken; name: string }
    | { kind: 'releaseSavepoint'; token: TransactionToken; name: string }
  >
}

const defaultCapabilities: DatabaseCapabilities = {
  returning: true,
  savepoints: true,
  upsert: true,
  transactionalDdl: false,
  migrationLock: false,
}

export class TestDatabase extends DatabaseImplementation {
  #driver: DatabaseAdapter

  constructor(driver: DatabaseAdapter, options?: DatabaseOptions) {
    super(options)
    this.#driver = driver
  }

  get dialect(): string {
    return this.#driver.dialect
  }

  get capabilities(): DatabaseCapabilities {
    return this.#driver.capabilities
  }

  compileSql(operation: Parameters<DatabaseAdapter['compileSql']>[0]): SqlStatement[] {
    return this.#driver.compileSql(operation)
  }

  execute(request: DataManipulationRequest): Promise<DataManipulationResult> {
    return this.#driver.execute(request)
  }

  executeScript(sql: string, transaction?: TransactionToken): Promise<void> {
    return this.#driver.executeScript(sql, transaction)
  }

  hasTable(table: TableRef, transaction?: TransactionToken): Promise<boolean> {
    return this.#driver.hasTable(table, transaction)
  }

  hasColumn(table: TableRef, column: string, transaction?: TransactionToken): Promise<boolean> {
    return this.#driver.hasColumn(table, column, transaction)
  }

  beginTransaction(options?: TransactionOptions): Promise<TransactionToken> {
    return this.#driver.beginTransaction(options)
  }

  commitTransaction(token: TransactionToken): Promise<void> {
    return this.#driver.commitTransaction(token)
  }

  rollbackTransaction(token: TransactionToken): Promise<void> {
    return this.#driver.rollbackTransaction(token)
  }

  createSavepoint(token: TransactionToken, name: string): Promise<void> {
    return this.#driver.createSavepoint(token, name)
  }

  rollbackToSavepoint(token: TransactionToken, name: string): Promise<void> {
    return this.#driver.rollbackToSavepoint(token, name)
  }

  releaseSavepoint(token: TransactionToken, name: string): Promise<void> {
    return this.#driver.releaseSavepoint(token, name)
  }

  close(): void | Promise<void> {
    return this.#driver.close?.()
  }

  async wipe(): Promise<void> {
    if (!this.#driver.wipe) throw new Error('Test database does not support wipe()')
    await this.#driver.wipe()
  }
}

export function createRecordingAdapter(options: RecordingAdapterOptions = {}): RecordingAdapter {
  let requests: DataManipulationRequest[] = []
  let transactions: RecordingAdapter['transactions'] = []
  let transactionId = 0

  let adapter: DatabaseAdapter = {
    dialect: options.dialect ?? 'recording',
    capabilities: {
      ...defaultCapabilities,
      ...options.capabilities,
    },
    compileSql() {
      return [] satisfies SqlStatement[]
    },
    async execute(request) {
      requests.push(request)

      if (options.execute) {
        return await options.execute(request)
      }

      return {}
    },
    async executeScript() {},
    async hasTable() {
      return true
    },
    async hasColumn() {
      return true
    },
    async beginTransaction(transactionOptions) {
      let token = { id: `tx_${++transactionId}` }
      transactions.push({ kind: 'begin', options: transactionOptions, token })
      return token
    },
    async commitTransaction(token) {
      transactions.push({ kind: 'commit', token })
    },
    async rollbackTransaction(token) {
      transactions.push({ kind: 'rollback', token })
    },
    async createSavepoint(token, name) {
      transactions.push({ kind: 'createSavepoint', token, name })
    },
    async rollbackToSavepoint(token, name) {
      transactions.push({ kind: 'rollbackToSavepoint', token, name })
    },
    async releaseSavepoint(token, name) {
      transactions.push({ kind: 'releaseSavepoint', token, name })
    },
  }

  return { adapter, requests, transactions }
}
