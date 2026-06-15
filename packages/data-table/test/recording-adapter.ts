import type {
  AdapterCapabilities,
  DataManipulationRequest,
  DataManipulationResult,
  DatabaseAdapter,
  TransactionOptions,
  TransactionToken,
} from '../src/lib/adapter.ts'
import type { SqlStatement } from '../src/lib/sql.ts'

export type RecordingAdapterOptions = {
  dialect?: string
  capabilities?: Partial<AdapterCapabilities>
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

const defaultCapabilities: AdapterCapabilities = {
  returning: true,
  savepoints: true,
  upsert: true,
  transactionalDdl: false,
  migrationLock: false,
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
