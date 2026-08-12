import type {
  DatabaseCapabilities,
  DataManipulationOperation,
  DataManipulationResult,
  TransactionOptions,
} from '../adapter.ts'
import type { Database } from '../database.ts'

export const executeOperation = Symbol('executeOperation')
export const runInTransaction = Symbol('runInTransaction')

export type QueryExecutionContext<dialect extends string = string> = Database<dialect> & {
  capabilities: DatabaseCapabilities
  now(): unknown
  [executeOperation](operation: DataManipulationOperation): Promise<DataManipulationResult>
  [runInTransaction]<result>(
    callback: (database: QueryExecutionContext<dialect>) => Promise<result>,
    options?: TransactionOptions,
  ): Promise<result>
}
