import type {
  DatabaseCapabilities,
  DataManipulationRequest,
  DataManipulationResult,
  DatabaseDriver,
  TransactionOptions,
  TransactionToken,
} from '../src/lib/adapter.ts'
import { Database, type DatabaseOptions } from '../src/lib/database.ts'

export type RecordingAdapterOptions = {
  dialect?: string
  capabilities?: Partial<DatabaseCapabilities>
  execute?(request: DataManipulationRequest): Promise<DataManipulationResult>
}

export type RecordingAdapter = {
  adapter: DatabaseDriver
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

export class TestDatabase extends Database {
  constructor(driver: DatabaseDriver, options?: DatabaseOptions) {
    super(driver, options)
  }
}

export function createRecordingAdapter(options: RecordingAdapterOptions = {}): RecordingAdapter {
  let requests: DataManipulationRequest[] = []
  let transactions: RecordingAdapter['transactions'] = []
  let transactionId = 0

  let adapter: DatabaseDriver = {
    dialect: options.dialect ?? 'recording',
    capabilities: {
      ...defaultCapabilities,
      ...options.capabilities,
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
    async wipe() {},
    close() {},
  }

  return { adapter, requests, transactions }
}
