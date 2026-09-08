import type {
  DatabaseCapabilities,
  DataManipulationOperation,
  DataManipulationResult,
  TransactionOptions,
} from '../driver.ts'

export const executeOperation = Symbol('executeOperation')
export const runInTransaction = Symbol('runInTransaction')

export type QueryExecutionContext<dialect extends string = string> = {
  capabilities: DatabaseCapabilities
  now(): unknown
  [executeOperation](operation: DataManipulationOperation): Promise<DataManipulationResult>
  [runInTransaction]<result>(
    callback: (database: QueryExecutionContext<dialect>) => Promise<result>,
    options?: TransactionOptions,
  ): Promise<result>
}
